import type { EmbeddingService } from './EmbeddingService.js';
import { DefaultEmbeddingService } from './DefaultEmbeddingService.js';
import { GoogleEmbeddingService } from './GoogleEmbeddingService.js';
import { OpenAIEmbeddingService } from './OpenAIEmbeddingService.js';
import { logger } from '../utils/logger.js';

/**
 * Configuration options for embedding services
 */
export interface EmbeddingServiceConfig {
  provider?: string;
  model?: string;
  dimensions?: number;
  apiKey?: string;
  apiEndpoint?: string;
  [key: string]: unknown;
}

/**
 * Type definition for embedding service provider creation function
 */
type EmbeddingServiceProvider = (config?: EmbeddingServiceConfig) => EmbeddingService;

/**
 * Factory for creating embedding services
 */
export class EmbeddingServiceFactory {
  /**
   * Registry of embedding service providers
   */
  private static providers: Record<string, EmbeddingServiceProvider> = {};

  /**
   * Register a new embedding service provider
   *
   * @param name - Provider name
   * @param provider - Provider factory function
   */
  static registerProvider(name: string, provider: EmbeddingServiceProvider): void {
    EmbeddingServiceFactory.providers[name.toLowerCase()] = provider;
  }

  /**
   * Reset the provider registry - used primarily for testing
   */
  static resetRegistry(): void {
    EmbeddingServiceFactory.providers = {};
  }

  /**
   * Get a list of available provider names
   *
   * @returns Array of provider names
   */
  static getAvailableProviders(): string[] {
    return Object.keys(EmbeddingServiceFactory.providers);
  }

  /**
   * Create a service using a registered provider
   *
   * @param config - Configuration options including provider name and service-specific settings
   * @returns The created embedding service
   * @throws Error if the provider is not registered
   */
  static createService(config: EmbeddingServiceConfig = {}): EmbeddingService {
    const providerName = (config.provider || 'default').toLowerCase();
    logger.debug(`EmbeddingServiceFactory: Creating service with provider "${providerName}"`);

    const providerFn = EmbeddingServiceFactory.providers[providerName];

    if (providerFn) {
      try {
        const service = providerFn(config);
        logger.debug(
          `EmbeddingServiceFactory: Service created successfully with provider "${providerName}"`,
          {
            modelInfo: service.getModelInfo(),
          }
        );
        return service;
      } catch (error) {
        logger.error(
          `EmbeddingServiceFactory: Failed to create service with provider "${providerName}"`,
          error
        );
        throw error;
      }
    }

    // If provider not found, throw an error
    logger.error(`EmbeddingServiceFactory: Provider "${providerName}" is not registered`);
    throw new Error(`Provider "${providerName}" is not registered`);
  }

  /**
   * Create an embedding service from environment variables
   *
   * @returns An embedding service implementation
   */
  static createFromEnvironment(): EmbeddingService {
    // Check if we should use mock embeddings (for testing)
    const useMockEmbeddings = process.env.MOCK_EMBEDDINGS === 'true';

    logger.debug('EmbeddingServiceFactory: Creating service from environment variables', {
      mockEmbeddings: useMockEmbeddings,
      openaiKeyPresent: !!process.env.OPENAI_API_KEY,
      googleKeyPresent: !!process.env.GOOGLE_API_KEY,
      embeddingModel: process.env.EMBEDDING_MODEL || 'default',
      embeddingEndpoint: process.env.EMBEDDING_ENDPOINT,
    });

    if (useMockEmbeddings) {
      logger.info('EmbeddingServiceFactory: Using mock embeddings for testing');
      return new DefaultEmbeddingService();
    }

    const embeddingModel = process.env.EMBEDDING_MODEL;
    const embeddingDimensions = process.env.EMBEDDING_DIMENSIONS
      ? parseInt(process.env.EMBEDDING_DIMENSIONS, 10)
      : undefined;
    const embeddingEndpoint = process.env.EMBEDDING_ENDPOINT;
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const googleApiKey = process.env.GOOGLE_API_KEY;

    let provider: 'google' | 'openai' | undefined;

    // Determine provider based on model name first
    if (embeddingModel) {
      if (embeddingModel.startsWith('models/') || embeddingModel.includes('embedding-00')) {
        provider = 'google';
      } else if (embeddingModel.startsWith('text-embedding-')) {
        provider = 'openai';
      }
    }

    // If provider not determined by model, use API keys as a fallback
    if (!provider) {
      if (openaiApiKey) {
        provider = 'openai';
      } else if (googleApiKey) {
        provider = 'google';
      }
    }

    logger.debug(`EmbeddingServiceFactory: Selected provider "${provider || 'none'}"`);

    if (provider === 'google') {
      if (!googleApiKey) {
        logger.error('Google provider selected, but GOOGLE_API_KEY is missing.');
      } else {
        try {
          logger.debug('EmbeddingServiceFactory: Creating Google embedding service.');
          return new GoogleEmbeddingService({
            apiKey: googleApiKey,
            model: embeddingModel,
            dimensions: embeddingDimensions,
            apiEndpoint: embeddingEndpoint,
          });
        } catch (error) {
          logger.error('EmbeddingServiceFactory: Failed to create Google service', error);
        }
      }
    }

    if (provider === 'openai') {
      if (!openaiApiKey) {
        logger.error('OpenAI provider selected, but OPENAI_API_KEY is missing.');
      } else {
        try {
          logger.debug('EmbeddingServiceFactory: Creating OpenAI embedding service.');
          return new OpenAIEmbeddingService({
            apiKey: openaiApiKey,
            model: embeddingModel || 'text-embedding-3-small',
            dimensions: embeddingDimensions,
            apiEndpoint: embeddingEndpoint,
          });
        } catch (error) {
          logger.error('EmbeddingServiceFactory: Failed to create OpenAI service', error);
        }
      }
    }

    logger.info(
      'EmbeddingServiceFactory: No provider could be successfully initialized. Falling back to default service.'
    );
    return new DefaultEmbeddingService();
  }

  /**
   * Create an OpenAI embedding service
   *
   * @param apiKey - OpenAI API key
   * @param model - Optional model name
   * @param dimensions - Optional embedding dimensions
   * @returns OpenAI embedding service
   */
  static createOpenAIService(
    apiKey: string,
    model?: string,
    dimensions?: number,
    apiEndpoint?: string
  ): EmbeddingService {
    return new OpenAIEmbeddingService({
      apiKey,
      model,
      dimensions,
      apiEndpoint,
    });
  }

  /**
   * Create a default embedding service that generates random vectors
   *
   * @param dimensions - Optional embedding dimensions
   * @returns Default embedding service
   */
  static createDefaultService(dimensions?: number): EmbeddingService {
    return new DefaultEmbeddingService(dimensions);
  }
}

// Register built-in providers
EmbeddingServiceFactory.registerProvider('default', (config = {}) => {
  return new DefaultEmbeddingService(config.dimensions);
});

EmbeddingServiceFactory.registerProvider('openai', (config = {}) => {
  if (!config.apiKey) {
    throw new Error('API key is required for OpenAI embedding service');
  }

  return new OpenAIEmbeddingService({
    apiKey: config.apiKey,
    model: config.model,
    dimensions: config.dimensions,
    apiEndpoint: config.apiEndpoint,
  });
});

EmbeddingServiceFactory.registerProvider('google', (config = {}) => {
  if (!config.apiKey) {
    throw new Error('API key is required for Google embedding service');
  }
  return new GoogleEmbeddingService({
    apiKey: config.apiKey,
    model: config.model,
    dimensions: config.dimensions,
  });
});
