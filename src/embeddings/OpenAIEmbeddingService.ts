import axios from 'axios';
import { EmbeddingService, type EmbeddingModelInfo } from './EmbeddingService.js';
import { logger } from '../utils/logger.js';

/**
 * Configuration for OpenAI embedding service
 */
export interface OpenAIEmbeddingConfig {
  /**
   * OpenAI API key
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

// API key error message is defined but not used directly
// It's kept for documentation purposes
// const _API_KEY_ERROR = 'OpenAI API key is required. Set OPENAI_API_KEY environment variable.';

/**
 * OpenAI API response structure
 */
interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
    object: string;
  }>;
  model: string;
  object: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Service implementation that generates embeddings using OpenAI's API
 */
export class OpenAIEmbeddingService extends EmbeddingService {
  private apiKey: string;
  private model: string;
  private dimensions: number;
  private version: string;
  private apiEndpoint: string;

  /**
   * Create a new OpenAI embedding service
   *
   * @param config - Configuration for the service
   */
  constructor(config: OpenAIEmbeddingConfig) {
    super();

    if (!config) {
      throw new Error('Configuration is required for OpenAI embedding service');
    }

    // Only require API key in non-test environments and when it's not provided in env
    if (!config.apiKey && !process.env.OPENAI_API_KEY) {
      throw new Error('API key is required for OpenAI embedding service');
    }

    this.apiKey = process.env.OPENAI_API_KEY || config.apiKey || '';
    this.model = config.model ||
      process.env.EMBEDDING_MODEL ||
      'text-embedding-3-small';
    this.dimensions = config.dimensions || 1536; // text-embedding-3-small has 1536 dimensions
    this.version = config.version || '3.0.0';
    this.apiEndpoint =
      config.apiEndpoint ||
      process.env.EMBEDDING_ENDPOINT ||
      'https://api.openai.com/v1/embeddings';
  }

  /**
   * Generate an embedding for a single text
   *
   * @param text - Text to generate embedding for
   * @returns Promise resolving to embedding vector
   */
  override async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('No OpenAI API key available');
    }

    logger.debug('Generating embedding', {
      text: text.substring(0, 50) + '...',
      model: this.model,
      dimensions: this.dimensions,
      apiEndpoint: this.apiEndpoint,
    });

    try {
      const payload: {
        input: string;
        model: string;
        dimensions?: number;
      } = {
        input: text,
        model: this.model,
      };

      if (process.env.ENABLE_CUSTOM_DIMENSIONS === 'true' && this.dimensions) {
        payload.dimensions = this.dimensions;
      }

      console.log('OpenAI Payload:', JSON.stringify(payload, null, 2));

      const response = await axios.post<OpenAIEmbeddingResponse>(
        this.apiEndpoint,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        }
      );

      logger.debug('Received response from OpenAI API');

      if (!response.data || !response.data.data || !response.data.data[0]) {
        logger.error('Invalid response from OpenAI API', { response: response.data });
        throw new Error('Invalid response from OpenAI API - missing embedding data');
      }

      const embedding = response.data.data[0].embedding;

      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        logger.error('Invalid embedding returned', { embedding });
        throw new Error('Invalid embedding returned from OpenAI API');
      }

      logger.debug('Generated embedding', {
        length: embedding.length,
        sample: embedding.slice(0, 5),
        isArray: Array.isArray(embedding),
      });

      // Log token usage if in debug mode
      if (process.env.DEBUG === 'true') {
        const tokens = response.data.usage?.prompt_tokens || 'unknown';
        logger.debug('OpenAI embedding token usage', { tokens });
      }

      // Normalize the embedding vector
      this._normalizeVector(embedding);
      logger.debug('Normalized embedding', {
        length: embedding.length,
        sample: embedding.slice(0, 5),
      });

      return embedding;
    } catch (error: unknown) {
      // Handle axios errors specifically
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

        logger.error('OpenAI API error', {
          status: statusCode,
          data: responseData,
          message: axiosError.message,
        });

        // Include response data in error if available
        const errorDetails = responseData
          ? `: ${JSON.stringify(responseData).substring(0, 200)}`
          : '';

        // Handle specific error types
        if (statusCode === 401) {
          throw new Error(`OpenAI API authentication failed - invalid API key${errorDetails}`);
        } else if (statusCode === 429) {
          throw new Error(`OpenAI API rate limit exceeded - try again later${errorDetails}`);
        } else if (statusCode && statusCode >= 500) {
          throw new Error(`OpenAI API server error (${statusCode}) - try again later${errorDetails}`);
        }

        
        throw new Error(`OpenAI API error (${statusCode || 'unknown'})${errorDetails}`);
      }

      // Handle other errors
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
    try {
      const payload: {
        input: string[];
        model: string;
        dimensions?: number;
      } = {
        input: texts,
        model: this.model,
      };

      if (process.env.ENABLE_CUSTOM_DIMENSIONS === 'true' && this.dimensions) {
        payload.dimensions = this.dimensions;
      }

      const response = await axios.post<OpenAIEmbeddingResponse>(
        this.apiEndpoint,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const embeddings = response.data.data.map((item) => item.embedding);

      // Normalize each embedding vector
      embeddings.forEach((embedding) => {
        this._normalizeVector(embedding);
      });

      return embeddings;
    } catch (error: unknown) {
      const errorMessage = this._getErrorMessage(error);
      throw new Error(`Failed to generate embeddings: ${errorMessage}`);
    }
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
    // Calculate magnitude (Euclidean norm / L2 norm)
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
