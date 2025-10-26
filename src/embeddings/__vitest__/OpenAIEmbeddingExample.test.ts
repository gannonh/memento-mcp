import { describe, it, expect, beforeAll } from 'vitest';
import { EmbeddingServiceFactory } from '../EmbeddingServiceFactory.js';
import type { EmbeddingService } from '../EmbeddingService';

// This is a live test that connects to OpenAI and generates real embeddings
// If OpenAI API key isn't available, it will fall back to the default provider
describe('OpenAI Embedding Live Example', () => {
  let embeddingService: EmbeddingService;
  let hasApiKey = false;
  // Check for mock mode
  const useMockEmbeddings = process.env.MOCK_EMBEDDINGS === 'true';

  console.log(
    `OpenAI API example tests WILL run (using API key: ${process.env.OPENAI_API_KEY !== undefined}, mock=${useMockEmbeddings})`
  );

  beforeAll(() => {
    // Initialize the embedding services
    hasApiKey = process.env.OPENAI_API_KEY !== undefined;

    // Create a service with the OpenAI provider if available, otherwise fallback to default
    if (hasApiKey && !useMockEmbeddings) {
      embeddingService = EmbeddingServiceFactory.createService({
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY!,
        model: 'text-embedding-3-small',
      });
      console.log('Using OpenAI embedding service with real API key');
    } else {
      embeddingService = EmbeddingServiceFactory.createService({
        provider: 'default',
        dimensions: 1536, // Match OpenAI dimensions for testing
      });
      console.log('Using default embedding service fallback');
    }
  });

  it('generates embeddings from the API', async () => {
    // Generate an embedding for a text sample
    const text = 'The quick brown fox jumps over the lazy dog';
    const embedding = await embeddingService.generateEmbedding(text);

    // Verify the embedding properties
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(1536); // text-embedding-3-small has 1536 dimensions

    // Check that the embedding is normalized
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    expect(magnitude).toBeCloseTo(1.0, 1);
  });

  it('generates embeddings for multiple texts in a batch', async () => {
    // Generate embeddings for multiple text samples
    const texts = [
      'Machine learning is a subset of artificial intelligence',
      'Natural language processing is used for text understanding',
      'Vector embeddings represent semantic meaning in a high-dimensional space',
    ];

    const embeddings = await embeddingService.generateEmbeddings(texts);

    // Verify the embeddings properties
    expect(Array.isArray(embeddings)).toBe(true);
    expect(embeddings.length).toBe(3);

    // Check each embedding
    embeddings.forEach((embedding, index) => {
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536);

      // Check that each embedding is normalized
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      expect(magnitude).toBeCloseTo(1.0, 1);
    });

    // Skip similarity check if using a custom endpoint, as the model may be different
    if (process.env.OPENAI_EMBEDDING_ENDPOINT) {
      console.log('Skipping similarity check due to custom endpoint');
      return;
    }

    // Calculate cosine similarities between embeddings to demonstrate semantic relationships
    const similarity12 = calculateCosineSimilarity(embeddings[0], embeddings[1]);
    const similarity13 = calculateCosineSimilarity(embeddings[0], embeddings[2]);
    const similarity23 = calculateCosineSimilarity(embeddings[1], embeddings[2]);

    // Check that all similarities are reasonable values
    // (actual semantic relationships can vary based on the embedding model's understanding)
    expect(similarity12).toBeGreaterThan(0.2);
    expect(similarity13).toBeGreaterThan(0.2);
    expect(similarity23).toBeGreaterThan(0.2);

    // Verify that the similarities are relatively close to each other (within 0.3)
    // This is a more robust test than assuming specific relative magnitudes
    expect(Math.abs(similarity12 - similarity13)).toBeLessThan(0.3);
    expect(Math.abs(similarity12 - similarity23)).toBeLessThan(0.3);
    expect(Math.abs(similarity13 - similarity23)).toBeLessThan(0.3);
  });
});

/**
 * Calculate cosine similarity between two vectors
 * @param vecA - First vector
 * @param vecB - Second vector
 * @returns Cosine similarity (between -1 and 1)
 */
function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same dimensions');
  }

  // For normalized vectors, the dot product equals cosine similarity
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }

  return dotProduct;
}
