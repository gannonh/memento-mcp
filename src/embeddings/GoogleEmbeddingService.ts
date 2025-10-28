import axios from 'axios';
import { EmbeddingService, type EmbeddingModelInfo } from './EmbeddingService.js';
import { logger } from '../utils/logger.js';

/**
 * Configuration for Google embedding service
 */
export interface GoogleEmbeddingConfig {
  /**
   * Google API key
   */
  apiKey: string;

  /**
   * Optional model name to use
   */
  model?: string;

  /**
   * Optional dimensions override
   */
  dimensions?: number;

  /**
   * Optional version string
   */
  version?: string;

  /**
   * Optional API endpoint URL
   */
  apiEndpoint?: string;
}

/**
 * Google API response structure
 */
interface GoogleEmbeddingResponse {
  embedding: {
    values: number[];
  };
}

/**
 * Service implementation that generates embeddings using Google's API
 */
export class GoogleEmbeddingService extends EmbeddingService {
  private apiKey: string;
  private model: string;
  private dimensions: number;
  private version: string;
  private apiEndpoint: string;

  /**
   * Create a new Google embedding service
   *
   * @param config - Configuration for the service
   */
  constructor(config: GoogleEmbeddingConfig) {
    super();

    if (!config) {
      throw new Error('Configuration is required for Google embedding service');
    }

    if (!config.apiKey) {
      throw new Error('API key is required for Google embedding service');
    }

    this.apiKey = config.apiKey;
    this.model = config.model || 'gemini-embedding-001';
    this.dimensions = config.dimensions || 3072;
    this.version = config.version || '1.0.0';
    this.apiEndpoint =
      config.apiEndpoint ||
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent`;
  }

  /**
   * Generate an embedding for a single text
   *
   * @param text - Text to generate embedding for
   * @returns Promise resolving to embedding vector
   */
  override async generateEmbedding(text: string): Promise<number[]> {
    logger.debug('Generating embedding with Google', {
      text: text.substring(0, 50) + '...',
      model: this.model,
      apiEndpoint: this.apiEndpoint,
    });

    try {
      const payload: {
        model: string;
        content: { parts: { text: string }[] };
        output_dimensionality?: number;
      } = {
        model: `models/${this.model}`,
        content: {
          parts: [{ text }],
        },
      };

      if (process.env.ENABLE_CUSTOM_DIMENSIONS === 'true' && this.dimensions) {
        payload.output_dimensionality = this.dimensions;
      }

      console.log('Google Payload:', JSON.stringify(payload, null, 2));

      const response = await axios.post<GoogleEmbeddingResponse>(
        `${this.apiEndpoint}`,
        payload,
        {
          headers: {
            "x-goog-api-key": this.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        }
      );

      logger.debug('Received response from Google API');

      if (!response.data || !response.data.embedding || !response.data.embedding.values) {
        logger.error('Invalid response from Google API', { response: response.data });
        throw new Error('Invalid response from Google API - missing embedding data');
      }

      const embedding = response.data.embedding.values;

      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        logger.error('Invalid embedding returned', { embedding });
        throw new Error('Invalid embedding returned from Google API');
      }

      logger.debug('Generated embedding', {
        length: embedding.length,
        sample: embedding.slice(0, 5),
        isArray: Array.isArray(embedding),
      });

      // The Gemini API documentation does not specify if the embeddings are normalized.
      // Assuming they are not, and normalizing for consistency with the OpenAI service.
      this._normalizeVector(embedding);
      logger.debug('Normalized embedding', {
        length: embedding.length,
        sample: embedding.slice(0, 5),
      });

      return embedding;
    } catch (error: unknown) {
      const axiosError = error as {
        isAxiosError?: boolean;
        response?: {
          status?: number;
          data?: unknown;
        };
        message?: string;
      };
      if (axiosError.isAxiosError) {
        const statusCode = axiosError.response?.status;
        const responseData = axiosError.response?.data;

        logger.error('Google API error', {
          status: statusCode,
          data: responseData,
          message: axiosError.message,
        });

        const errorDetails = responseData
          ? `: ${JSON.stringify(responseData).substring(0, 200)}`
          : '';

        if (statusCode === 401 || statusCode === 403) {
          throw new Error(`Google API authentication failed - invalid API key${errorDetails}`);
        } else if (statusCode === 429) {
          throw new Error(`Google API rate limit exceeded - try again later${errorDetails}`);
        } else if (statusCode && statusCode >= 500) {
          throw new Error(`Google API server error (${statusCode}) - try again later${errorDetails}`);
        }

        throw new Error(`Google API error (${statusCode || 'unknown'})${errorDetails}`);
      }

      const errorMessage = this._getErrorMessage(error);
      logger.error('Failed to generate embedding', { error: errorMessage });
      throw new Error(`Error generating embedding: ${errorMessage}`);
    }
  }

  /**
   * Generate embeddings for multiple texts
   *
   * @param texts - Array of texts to generate embeddings for
   * @returns Promise resolving to array of embedding vectors
   */
  override async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // The batchEmbedContents endpoint is more complex, for now, we will call generateEmbedding in parallel
    // This is less efficient but simpler to implement correctly based on the docs.
    return Promise.all(texts.map(text => this.generateEmbedding(text)));
  }

  /**
   * Get information about the embedding model
   *
   * @returns Model information
   */
  override getModelInfo(): EmbeddingModelInfo {
    return {
      name: this.model,
      dimensions: this.dimensions,
      version: this.version,
    };
  }

  /**
   * Extract error message from error object
   *
   * @private
   * @param error - Error object
   * @returns Error message string
   */
  private _getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * Normalize a vector to unit length (L2 norm)
   *
   * @private
   * @param vector - Vector to normalize in-place
   */
  private _normalizeVector(vector: number[]): void {
    let magnitude = 0;
    for (let i = 0; i < vector.length; i++) {
      magnitude += vector[i] * vector[i];
    }
    magnitude = Math.sqrt(magnitude);

    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    } else {
      vector[0] = 1;
    }
  }
}
