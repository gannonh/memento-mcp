import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCallToolRequest } from '../callToolHandler';

describe('Diagnostic Tool Handlers', () => {
  // Mock process.env and stderr.write
  const originalEnv = process.env;
  const processWriteSpy = vi.spyOn(process.stderr, 'write');

  // Mock knowledge graph manager
  let mockKnowledgeGraphManager: any;

  beforeEach(() => {
    // Reset process.env
    process.env = { ...originalEnv };

    // Reset the spy
    processWriteSpy.mockClear();

    // Create fresh mock knowledge graph manager
    mockKnowledgeGraphManager = {
      openNodes: vi.fn().mockResolvedValue({
        entities: [{ id: '123', name: 'TestEntity', observations: ['Test observation'] }],
        relations: [],
      }),
      embeddingJobManager: {
        _prepareEntityText: vi.fn().mockReturnValue('Prepared text content'),
        embeddingService: {
          generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
          getModelInfo: vi.fn().mockReturnValue({
            name: 'test-embedding-model',
            dimensions: 1536,
          }),
        },
        getPendingJobs: vi.fn().mockReturnValue([]),
      },
      storageProvider: {
        storeEntityVector: vi.fn().mockResolvedValue(undefined),
        getEntityEmbedding: vi.fn().mockResolvedValue({
          vector: new Array(1536).fill(0.1),
          model: 'test-embedding-model',
          lastUpdated: Date.now(),
        }),
        countEntitiesWithEmbeddings: vi.fn().mockResolvedValue(0),
        vectorStore: {
          isInitialized: true,
        },
        getConnectionManager: vi.fn().mockReturnValue({
          isConnected: true,
        }),
        constructor: {
          name: 'Neo4jStorageProvider',
        },
        db: {
          prepare: vi.fn().mockReturnValue({
            all: vi
              .fn()
              .mockReturnValue([
                { name: 'id' },
                { name: 'name' },
                { name: 'observations' },
                { name: 'vector_data' },
              ]),
            get: vi.fn().mockReturnValue({ count: 3 }),
            run: vi.fn(),
          }),
          exec: vi.fn(),
        },
      },
      search: vi.fn(),
    };
  });

  describe('force_generate_embedding tool', () => {
    it('should fetch the entity and generate an embedding', async () => {
      // Create request for force_generate_embedding
      const request = {
        params: {
          name: 'force_generate_embedding',
          arguments: {
            entity_name: 'TestEntity',
          },
        },
      };

      // Call the handler
      const result = await handleCallToolRequest(request, mockKnowledgeGraphManager);

      // Check results
      expect(mockKnowledgeGraphManager.openNodes).toHaveBeenCalledWith([]); // First call with empty array to get all entities
      expect(mockKnowledgeGraphManager.embeddingJobManager._prepareEntityText).toHaveBeenCalled();
      expect(
        mockKnowledgeGraphManager.embeddingJobManager.embeddingService.generateEmbedding
      ).toHaveBeenCalledWith('Prepared text content');
      expect(mockKnowledgeGraphManager.storageProvider.storeEntityVector).toHaveBeenCalled();

      // Check response formatting
      expect(result).toHaveProperty('content');
      expect(result.content[0].type).toBe('text');

      // Parse the response JSON to check content
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.success).toBe(true);
      expect(responseData.entity).toBe('TestEntity');
      expect(responseData.vector_length).toBe(1536);

      // Verify debug logs
      expect(processWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Force generating embedding for entity: TestEntity')
      );
    });

    it('should handle errors when entity is not found', async () => {
      // Mock openNodes to return empty result for both the all entities call and specific entity call
      mockKnowledgeGraphManager.openNodes = vi.fn().mockImplementation((names) => {
        // Return empty array for any openNodes call
        return Promise.resolve({
          entities: [],
          relations: [],
        });
      });

      // Create request
      const request = {
        params: {
          name: 'force_generate_embedding',
          arguments: {
            entity_name: 'NonExistentEntity',
          },
        },
      };

      // Call the handler
      const result = await handleCallToolRequest(request, mockKnowledgeGraphManager);

      // Check error handling
      expect(result.content[0].text).toContain('Failed to generate embedding');
      expect(processWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Entity not found'));
    });
  });

  describe('debug_embedding_config tool', () => {
    it('should return configuration diagnostics', async () => {
      // Set up environment for testing
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.EMBEDDING_MODEL = 'text-embedding-ada-002';
      process.env.EMBEDDING_ENDPOINT = 'https://api.example.com/v1/embeddings';

      // Create request
      const request = {
        params: {
          name: 'debug_embedding_config',
          arguments: {},
        },
      };

      // Call the handler
      const result = await handleCallToolRequest(request, mockKnowledgeGraphManager);

      // Parse the response JSON
      const diagnosticInfo = JSON.parse(result.content[0].text);

      // Check diagnostic info
      expect(diagnosticInfo.embedding_config.openai_api_key_present).toBe(true);
      expect(diagnosticInfo.embedding_config.model).toBe('text-embedding-ada-002');
      expect(diagnosticInfo.embedding_config.endpoint).toBe(
        'https://api.example.com/v1/embeddings'
      );
      expect(diagnosticInfo.embedding_job_manager_initialized).toBe(true);
      expect(diagnosticInfo.entities_with_embeddings).toBe(0);
      expect(diagnosticInfo).toHaveProperty('embedding_service_info');
      expect(diagnosticInfo).toHaveProperty('environment_variables');
    });

    it('should handle missing API key', async () => {
      // Remove API key
      delete process.env.OPENAI_API_KEY;

      // Create request
      const request = {
        params: {
          name: 'debug_embedding_config',
          arguments: {},
        },
      };

      // Call the handler
      const result = await handleCallToolRequest(request, mockKnowledgeGraphManager);

      // Parse the response JSON
      const diagnosticInfo = JSON.parse(result.content[0].text);

      // Check that it shows API key is missing
      expect(diagnosticInfo.embedding_config.openai_api_key_present).toBe(false);
    });
  });

  describe('get_entity_embedding tool', () => {
    it('should retrieve an entity embedding', async () => {
      // Create request
      const request = {
        params: {
          name: 'get_entity_embedding',
          arguments: {
            entity_name: 'TestEntity',
          },
        },
      };

      // Call the handler
      const result = await handleCallToolRequest(request, mockKnowledgeGraphManager);

      // Check that the storage provider was called
      expect(mockKnowledgeGraphManager.storageProvider.getEntityEmbedding).toHaveBeenCalledWith(
        'TestEntity'
      );

      // Parse the response JSON
      const embeddingData = JSON.parse(result.content[0].text);

      // Check embedding data
      expect(embeddingData.entityName).toBe('TestEntity');
      expect(embeddingData.model).toBe('test-embedding-model');
      expect(embeddingData.dimensions).toBe(1536);
      expect(embeddingData).toHaveProperty('embedding');
      expect(embeddingData.embedding.length).toBe(1536);
    });

    it('should handle missing embeddings', async () => {
      // Mock getEntityEmbedding to return undefined
      mockKnowledgeGraphManager.storageProvider.getEntityEmbedding = vi
        .fn()
        .mockResolvedValue(undefined);

      // Create request
      const request = {
        params: {
          name: 'get_entity_embedding',
          arguments: {
            entity_name: 'TestEntity',
          },
        },
      };

      // Call the handler
      const result = await handleCallToolRequest(request, mockKnowledgeGraphManager);

      // Check error message
      expect(result.content[0].text).toContain('No embedding found for entity: TestEntity');
    });
  });

  describe('semantic_search tool', () => {
    it('should perform semantic search with default parameters', async () => {
      // Setup mock search response
      mockKnowledgeGraphManager.search = vi.fn().mockResolvedValue({
        entities: [{ id: '123', name: 'TestEntity', score: 0.85 }],
        relations: [],
        total: 1,
        timeTaken: 25,
      });

      // Create request
      const request = {
        params: {
          name: 'semantic_search',
          arguments: {
            query: 'test query',
          },
        },
      };

      // Call the handler
      const result = await handleCallToolRequest(request, mockKnowledgeGraphManager);

      // Check the search was called with correct parameters
      expect(mockKnowledgeGraphManager.search).toHaveBeenCalledWith('test query', {
        limit: 10,
        minSimilarity: 0.6,
        entityTypes: [],
        hybridSearch: true,
        semanticWeight: 0.6,
        semanticSearch: true,
      });

      // Parse the response JSON
      const searchResult = JSON.parse(result.content[0].text);

      // Check result format
      expect(searchResult).toHaveProperty('entities');
      expect(searchResult.entities.length).toBe(1);
      expect(searchResult.entities[0].name).toBe('TestEntity');
    });

    it('should perform semantic search with custom parameters', async () => {
      // Setup mock search response
      mockKnowledgeGraphManager.search = vi.fn().mockResolvedValue({
        entities: [{ id: '123', name: 'TestEntity', score: 0.85 }],
        relations: [],
        total: 1,
        timeTaken: 25,
      });

      // Create request with custom parameters
      const request = {
        params: {
          name: 'semantic_search',
          arguments: {
            query: 'custom query',
            limit: 5,
            min_similarity: 0.5,
            entity_types: ['Document'],
            hybrid_search: true,
            semantic_weight: 0.7,
          },
        },
      };

      // Call the handler
      const result = await handleCallToolRequest(request, mockKnowledgeGraphManager);

      // Check the search was called with correct custom parameters
      expect(mockKnowledgeGraphManager.search).toHaveBeenCalledWith('custom query', {
        limit: 5,
        minSimilarity: 0.5,
        entityTypes: ['Document'],
        hybridSearch: true,
        semanticWeight: 0.7,
        semanticSearch: true,
      });
    });

    it('should handle search errors', async () => {
      // Mock search to throw an error
      mockKnowledgeGraphManager.search = vi
        .fn()
        .mockRejectedValue(new Error('Search engine unavailable'));

      // Create request
      const request = {
        params: {
          name: 'semantic_search',
          arguments: {
            query: 'error query',
          },
        },
      };

      // Call the handler
      const result = await handleCallToolRequest(request, mockKnowledgeGraphManager);

      // Check error is returned properly
      expect(result.content[0].text).toContain('Error performing semantic search');
    });
  });
});
