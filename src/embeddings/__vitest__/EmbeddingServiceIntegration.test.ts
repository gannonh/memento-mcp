import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmbeddingService } from '../EmbeddingService.js';
import { DefaultEmbeddingService } from '../DefaultEmbeddingService.js';
import { OpenAIEmbeddingService } from '../OpenAIEmbeddingService.js';
import { EmbeddingServiceFactory } from '../EmbeddingServiceFactory.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const result = dotenv.config({ path: envPath });
  console.log(`Loaded .env file: ${result.error ? 'Failed' : 'Success'}`);
}

// Check if we should use mock embeddings
const useMockEmbeddings = process.env.MOCK_EMBEDDINGS === 'true';
console.log(`Using mock embeddings: ${useMockEmbeddings ? 'true' : 'false'}`);

// Check if we have an API key in the environment
const apiKey = process.env.OPENAI_API_KEY;
console.log(`API key available: ${apiKey ? 'true' : 'false'}`);

// Skip OpenAI integration tests if no key OR mock embeddings enabled
const shouldRunOpenAITests = apiKey && !useMockEmbeddings;
const skipIfNoKeyOrMockEnabled = shouldRunOpenAITests ? it : it.skip;

describe('Embedding Service Integration', () => {
  beforeEach(() => {
    // Reset the factory registrations between tests
    EmbeddingServiceFactory.resetRegistry();
  });

  it('should register and create services using the factory', () => {
    // Register our default provider
    EmbeddingServiceFactory.registerProvider(
      'default',
      (config: any) => new DefaultEmbeddingService(config)
    );

    // Get available providers
    const providers = EmbeddingServiceFactory.getAvailableProviders();
    expect(providers).toContain('default');

    // Create a service using the factory
    const service = EmbeddingServiceFactory.createService({
      provider: 'default',
      dimensions: 64,
    });
    expect(service).toBeInstanceOf(DefaultEmbeddingService);
    expect(service).toBeInstanceOf(EmbeddingService);

    // Verify the configuration was applied
    const modelInfo = service.getModelInfo();
    expect(modelInfo.dimensions).toBe(64);
  });

  it('should throw an error when attempting to use an unregistered provider', () => {
    expect(() => {
      EmbeddingServiceFactory.createService({
        provider: 'nonexistent',
      });
    }).toThrow(/Provider.*not registered/);
  });

  it('should register multiple providers and create the correct ones', () => {
    // Create mock providers
    class MockProvider1 extends EmbeddingService {
      getModelInfo() {
        return { name: 'mock1', dimensions: 10, version: '1.0' };
      }
      async generateEmbedding(): Promise<number[]> {
        return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      }
      async generateEmbeddings(): Promise<number[][]> {
        return [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]];
      }
    }

    class MockProvider2 extends EmbeddingService {
      getModelInfo() {
        return { name: 'mock2', dimensions: 5, version: '1.0' };
      }
      async generateEmbedding(): Promise<number[]> {
        return [1, 2, 3, 4, 5];
      }
      async generateEmbeddings(): Promise<number[][]> {
        return [[1, 2, 3, 4, 5]];
      }
    }

    // Register both providers
    EmbeddingServiceFactory.registerProvider('mock1', () => new MockProvider1());
    EmbeddingServiceFactory.registerProvider('mock2', () => new MockProvider2());

    // Create services of each type
    const service1 = EmbeddingServiceFactory.createService({
      provider: 'mock1',
    });
    const service2 = EmbeddingServiceFactory.createService({
      provider: 'mock2',
    });

    // Verify correct type creation
    expect(service1).toBeInstanceOf(MockProvider1);
    expect(service2).toBeInstanceOf(MockProvider2);

    // Verify they return different model info
    expect(service1.getModelInfo().dimensions).toBe(10);
    expect(service2.getModelInfo().dimensions).toBe(5);
  });

  it('should generate embeddings that match expected dimensions', async () => {
    // Register default provider
    EmbeddingServiceFactory.registerProvider(
      'default',
      (config: any) => new DefaultEmbeddingService(config)
    );

    // Create a service with specific dimensions
    const service = EmbeddingServiceFactory.createService({
      provider: 'default',
      dimensions: 32,
    });

    // Generate an embedding
    const embedding = await service.generateEmbedding('test text');

    // Verify dimensions
    expect(embedding.length).toBe(32);

    // Verify normalization (L2 norm should be ~1)
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    expect(magnitude).toBeCloseTo(1.0, 1);
  });

  skipIfNoKeyOrMockEnabled(
    'should use real OpenAI embeddings when API key is available',
    async () => {
      // Register OpenAI provider
      EmbeddingServiceFactory.registerProvider(
        'openai',
        (config: any) =>
          new OpenAIEmbeddingService({
            apiKey: config.apiKey || process.env.OPENAI_API_KEY || '',
            model: config.model || 'text-embedding-3-small',
            apiEndpoint: config.apiEndpoint || process.env.OPENAI_EMBEDDING_ENDPOINT,
          })
      );

      // Create a service with OpenAI
      const service = EmbeddingServiceFactory.createService({
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        apiEndpoint: process.env.OPENAI_EMBEDDING_ENDPOINT,
      });

      expect(service).toBeInstanceOf(OpenAIEmbeddingService);

      // Generate an embedding and check properties
      const embedding = await service.generateEmbedding(
        'This is a test of the OpenAI embedding service'
      );

      // OpenAI's text-embedding-3-small has 1536 dimensions
      expect(embedding.length).toBe(1536);

      // Verify normalization
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      expect(magnitude).toBeCloseTo(1.0, 5);

      // Generate multiple embeddings
      const embeddings = await service.generateEmbeddings([
        'First test sentence',
        'Second test sentence that is different',
        'Third completely unrelated sentence about cats',
      ]);

      expect(embeddings.length).toBe(3);

      // Similar sentences should have higher cosine similarity
      const cosineSimilarity = (a: number[], b: number[]): number => {
        const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
        return dotProduct; // Already normalized vectors, so dot product = cosine similarity
      };

      // Similar sentences should be more similar than dissimilar ones
      const sim12 = cosineSimilarity(embeddings[0], embeddings[1]);
      const sim13 = cosineSimilarity(embeddings[0], embeddings[2]);

      // First and second sentences should be more similar than first and third
      expect(sim12).toBeGreaterThan(sim13);
    }
  );
});
