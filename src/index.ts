#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { KnowledgeGraphManager } from './KnowledgeGraphManager.js';
import { initializeStorageProvider } from './config/storage.js';
import { setupServer } from './server/setup.js';
import { EmbeddingJobManager } from './embeddings/EmbeddingJobManager.js';
import { EmbeddingServiceFactory } from './embeddings/EmbeddingServiceFactory.js';
import { logger } from './utils/logger.js';

// Re-export the types and classes for use in other modules
export * from './KnowledgeGraphManager.js';
// Export the Relation type
export { RelationMetadata, Relation } from './types/relation.js';

// Initialize storage and create KnowledgeGraphManager
const storageProvider = initializeStorageProvider();

// Initialize embedding job manager only if storage provider supports it
let embeddingJobManager: EmbeddingJobManager | undefined = undefined;
try {
  // Force debug logging to help troubleshoot
  logger.debug(`OpenAI API key exists: ${!!process.env.OPENAI_API_KEY}`);
  logger.debug(`Google API key exists: ${!!process.env.GOOGLE_API_KEY}`);
  logger.debug(`Embedding model: ${process.env.EMBEDDING_MODEL || 'not set'}`);
  logger.debug(`Embedding endpoint: ${process.env.EMBEDDING_ENDPOINT || 'not set'}`);
  logger.debug(`Storage provider type: ${process.env.MEMORY_STORAGE_TYPE || 'default'}`);

  // Ensure at least one API key is defined for embedding generation
  if (!process.env.OPENAI_API_KEY && !process.env.GOOGLE_API_KEY) {
    logger.warn(
      'Neither OPENAI_API_KEY nor GOOGLE_API_KEY environment variable is set. Semantic search will use random embeddings.'
    );
  } else {
    logger.info('API key found, will use for generating embeddings');
  }

  // Initialize the embedding service
  const embeddingService = EmbeddingServiceFactory.createFromEnvironment();
  logger.debug(`Embedding service model info: ${JSON.stringify(embeddingService.getModelInfo())}`);

  // Configure rate limiting options - stricter limits to prevent OpenAI API abuse
  const rateLimiterOptions = {
    tokensPerInterval: process.env.EMBEDDING_RATE_LIMIT_TOKENS
      ? parseInt(process.env.EMBEDDING_RATE_LIMIT_TOKENS, 10)
      : 20, // Default: 20 requests per minute
    interval: process.env.EMBEDDING_RATE_LIMIT_INTERVAL
      ? parseInt(process.env.EMBEDDING_RATE_LIMIT_INTERVAL, 10)
      : 60 * 1000, // Default: 1 minute
  };

  logger.info('Initializing EmbeddingJobManager', {
    rateLimiterOptions,
    model: embeddingService.getModelInfo().name,
    storageType: process.env.MEMORY_STORAGE_TYPE || 'neo4j',
  });

  // For Neo4j (which is always the storage provider)
  // Create a compatible wrapper for the Neo4j storage provider
  const adaptedStorageProvider = {
    ...storageProvider,
    // Add a fake db with exec function for compatibility
    db: {
      exec: (sql: string) => {
        logger.debug(`Neo4j adapter: Received SQL: ${sql}`);
        // No-op, just for compatibility
        return null;
      },
      prepare: () => ({
        run: () => null,
        all: () => [],
        get: () => null,
      }),
    },
    // Make sure getEntity is available
    getEntity: async (name: string) => {
      if (typeof storageProvider.getEntity === 'function') {
        return storageProvider.getEntity(name);
      }
      const result = await storageProvider.openNodes([name]);
      return result.entities[0] || null;
    },
    // Make sure storeEntityVector is available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    storeEntityVector: async (name: string, embedding: any) => {
      logger.debug(`Neo4j adapter: storeEntityVector called for ${name}`, {
        embeddingType: typeof embedding,
        vectorLength: embedding?.vector?.length || 'no vector',
        model: embedding?.model || 'no model',
      });

      // Ensure embedding has the correct format
      const formattedEmbedding = {
        vector: embedding.vector || embedding,
        model: embedding.model || 'unknown',
        lastUpdated: embedding.lastUpdated || Date.now(),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (storageProvider as any).updateEntityEmbedding === 'function') {
        try {
          logger.debug(`Neo4j adapter: Using updateEntityEmbedding for ${name}`);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return await (storageProvider as any).updateEntityEmbedding(name, formattedEmbedding);
        } catch (error) {
          logger.error(`Neo4j adapter: Error in storeEntityVector for ${name}`, error);
          throw error;
        }
      } else {
        const errorMsg = `Neo4j adapter: Neither storeEntityVector nor updateEntityEmbedding implemented for ${name}`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }
    },
  };

  // Create the embedding job manager with adapted storage provider
  embeddingJobManager = new EmbeddingJobManager(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adaptedStorageProvider as any,
    embeddingService,
    rateLimiterOptions,
    null, // Use default cache options
    logger
  );

  // Schedule periodic processing for embedding jobs
  const EMBEDDING_PROCESS_INTERVAL = 10000; // 10 seconds - more frequent processing
  setInterval(async () => {
    try {
      // Process pending embedding jobs
      await embeddingJobManager?.processJobs(10);
    } catch (error) {
      // Log error but don't crash
      logger.error('Error in scheduled job processing', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }, EMBEDDING_PROCESS_INTERVAL);
} catch (error) {
  // Fail gracefully if embedding job manager initialization fails
  logger.error('Failed to initialize EmbeddingJobManager', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  embeddingJobManager = undefined;
}

// Create the KnowledgeGraphManager with the storage provider, embedding job manager, and vector store options
const knowledgeGraphManager = new KnowledgeGraphManager({
  storageProvider,
  embeddingJobManager,
  // Pass vector store options from storage provider if available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vectorStoreOptions: (storageProvider as any).vectorStoreOptions,
});

// Ensure the storeEntityVector method is available on KnowledgeGraphManager's storageProvider
// Cast to any to bypass type checking for internal properties
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const knowledgeGraphManagerAny = knowledgeGraphManager as any;

if (
  knowledgeGraphManagerAny.storageProvider &&
  typeof knowledgeGraphManagerAny.storageProvider.storeEntityVector !== 'function'
) {
  // Add the storeEntityVector method to the storage provider
  knowledgeGraphManagerAny.storageProvider.storeEntityVector = async (
    name: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    embedding: any
  ) => {
    logger.debug(`Neo4j knowledgeGraphManager adapter: storeEntityVector called for ${name}`, {
      embeddingType: typeof embedding,
      vectorLength: embedding?.vector?.length || 'no vector',
      model: embedding?.model || 'no model',
    });

    // Ensure embedding has the correct format
    const formattedEmbedding = {
      vector: embedding.vector || embedding,
      model: embedding.model || 'unknown',
      lastUpdated: embedding.lastUpdated || Date.now(),
    };

    if (typeof knowledgeGraphManagerAny.storageProvider.updateEntityEmbedding === 'function') {
      try {
        logger.debug(
          `Neo4j knowledgeGraphManager adapter: Using updateEntityEmbedding for ${name}`
        );
        return await knowledgeGraphManagerAny.storageProvider.updateEntityEmbedding(
          name,
          formattedEmbedding
        );
      } catch (error) {
        logger.error(
          `Neo4j knowledgeGraphManager adapter: Error in storeEntityVector for ${name}`,
          error
        );
        throw error;
      }
    } else {
      const errorMsg = `Neo4j knowledgeGraphManager adapter: updateEntityEmbedding not implemented for ${name}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
  };

  logger.info(
    'Added storeEntityVector adapter method to Neo4j storage provider for KnowledgeGraphManager'
  );
}

// Use a custom createEntities method for immediate job processing, but only if knowledgeGraphManager exists
if (knowledgeGraphManager && typeof knowledgeGraphManager.createEntities === 'function') {
  const originalCreateEntities = knowledgeGraphManager.createEntities.bind(knowledgeGraphManager);
  knowledgeGraphManager.createEntities = async function (entities) {
    // First call the original method to create the entities
    const result = await originalCreateEntities(entities);

    // Then process jobs immediately if we have an embedding job manager
    if (embeddingJobManager) {
      try {
        logger.info('Processing embedding jobs immediately after entity creation', {
          entityCount: entities.length,
          entityNames: entities.map((e) => e.name).join(', '),
        });
        await embeddingJobManager.processJobs(entities.length);
      } catch (error) {
        logger.error('Error processing embedding jobs immediately', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    }

    return result;
  };
}

// Setup the server with the KnowledgeGraphManager
const server = setupServer(knowledgeGraphManager);

// Export main function for testing
export async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Only run main if not in a test environment
if (!process.env.VITEST && !process.env.NODE_ENV?.includes('test')) {
  main().catch((error) => {
    // Log error but don't use console.error
    logger.error(`Main process terminated: ${error}`);
    process.exit(1);
  });
}
