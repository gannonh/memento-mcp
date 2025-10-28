import { logger } from '../utils/logger.js';
import { EmbeddingService, type EmbeddingModelInfo } from './EmbeddingService.js';
import type { EmbeddingServiceConfig } from './EmbeddingServiceFactory.js';

/**
 * Default embedding service implementation that generates random vectors.
 * This is a fallback service for testing and development environments
 * where an external API provider is not available.
 */
export class DefaultEmbeddingService extends EmbeddingService {
  private dimensions: number;
  private modelName: string;
  private modelVersion: string;

  /**
   * Create a new default embedding service instance
   *
   * @param config - Configuration options or dimensions
   * @param modelName - Name to use for the model (legacy parameter)
   * @param modelVersion - Version to use for the model (legacy parameter)
   */
  constructor(
    config: EmbeddingServiceConfig | number = 1536, // Default to OpenAI's dimensions for better test compatibility
    modelName = 'memento-mcp-mock',
    modelVersion = '1.0.0'
  ) {
    super();

    // Handle both object config and legacy number dimensions
    if (typeof config === 'number') {
      this.dimensions = config;
      this.modelName = modelName;
      this.modelVersion = modelVersion;
    } else {
      // For mock mode, default to OpenAI-compatible dimensions if not specified
      const isMockMode = process.env.MOCK_EMBEDDINGS === 'true';
      const defaultDimensions = isMockMode ? 1536 : 384;

      this.dimensions =
        config.dimensions ||
        (process.env.EMBEDDING_DIMENSIONS
          ? parseInt(process.env.EMBEDDING_DIMENSIONS, 10)
          : defaultDimensions);
      this.modelName = config.model || (isMockMode ? 'text-embedding-3-small-mock' : modelName);
      this.modelVersion = config.version?.toString() || modelVersion;
    }

    if (process.env.MOCK_EMBEDDINGS === 'true') {
      logger.info(`Using DefaultEmbeddingService in mock mode with dimensions: ${this.dimensions}`);
    }
  }

  /**
   * Generate an embedding vector for text
   *
   * @param text - Text to generate embedding for
   * @returns Promise resolving to a vector as Array
   */
  override async generateEmbedding(text: string): Promise<number[]> {
    // Generate deterministic embedding based on text
    // This keeps the same input text producing the same output vector
    const seed = this._hashString(text);

    // Create an array of the specified dimensions
    const vector = new Array(this.dimensions);

    // Fill with seeded random values
    for (let i = 0; i < this.dimensions; i++) {
      // Use a simple deterministic algorithm based on seed and position
      vector[i] = this._seededRandom(seed + i);
    }

    // Normalize the vector to unit length
    this._normalizeVector(vector);

    return vector;
  }

  /**
   * Generate embedding vectors for multiple texts
   *
   * @param texts - Array of texts to generate embeddings for
   * @returns Promise resolving to array of embedding vectors
   */
  override async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Generate embeddings for each text in parallel
    const embeddings: number[][] = [];

    for (const text of texts) {
      embeddings.push(await this.generateEmbedding(text));
    }

    return embeddings;
  }

  /**
   * Get information about the embedding model
   *
   * @returns Model information
   */
  override getModelInfo(): EmbeddingModelInfo {
    return {
      name: this.modelName,
      dimensions: this.dimensions,
      version: this.modelVersion,
    };
  }

  /**
   * Generate a simple hash from a string for deterministic random generation
   *
   * @private
   * @param text - Input text to hash
   * @returns Numeric hash value
   */
  private _hashString(text: string): number {
    let hash = 0;

    if (text.length === 0) return hash;

    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return hash;
  }

  /**
   * Seeded random number generator
   *
   * @private
   * @param seed - Seed value
   * @returns Random value between 0 and 1
   */
  private _seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  /**
   * Normalize a vector to unit length
   *
   * @private
   * @param vector - Vector to normalize
   */
  private _normalizeVector(vector: number[]): void {
    // Calculate magnitude (Euclidean norm)
    let magnitude = 0;
    for (let i = 0; i < vector.length; i++) {
      magnitude += vector[i] * vector[i];
    }
    magnitude = Math.sqrt(magnitude);

    // Avoid division by zero
    if (magnitude > 0) {
      // Normalize each component
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    } else {
      // If magnitude is 0, set first element to 1 for a valid unit vector
      vector[0] = 1;
    }
  }
}
