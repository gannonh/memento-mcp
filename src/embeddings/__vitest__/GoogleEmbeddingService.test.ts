import axios from 'axios';
import { GoogleEmbeddingService } from '../GoogleEmbeddingService.js';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

describe('GoogleEmbeddingService', () => {
  const apiKey = 'test-api-key';
  let originalEnableCustomDimensions: string | undefined;

  beforeEach(() => {
    originalEnableCustomDimensions = process.env.ENABLE_CUSTOM_DIMENSIONS;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.ENABLE_CUSTOM_DIMENSIONS = originalEnableCustomDimensions;
  });

  it('should create an instance with default model', () => {
    const service = new GoogleEmbeddingService({ apiKey });
    expect(service).toBeInstanceOf(GoogleEmbeddingService);
    expect(service.getModelInfo().name).toBe('gemini-embedding-001');
  });

  it('should create an instance with a custom model', () => {
    const service = new GoogleEmbeddingService({ apiKey, model: 'custom-model' });
    expect(service.getModelInfo().name).toBe('custom-model');
  });

  it('should throw an error if no API key is provided', () => {
    expect(() => new GoogleEmbeddingService({ apiKey: '' })).toThrow('API key is required for Google embedding service');
  });

  it('should generate an embedding for a single text', async () => {
    const service = new GoogleEmbeddingService({ apiKey });
    const mockEmbedding = {
      embedding: {
        values: Array.from({ length: 3072 }, (_, i) => i * 0.001),
      },
    };
    const mockPost = vi.spyOn(axios, 'post').mockResolvedValue({ data: mockEmbedding });
    process.env.ENABLE_CUSTOM_DIMENSIONS = 'false';

    const embedding = await service.generateEmbedding('Hello world');
    expect(embedding).toBeInstanceOf(Array);
    expect(embedding.length).toBe(3072);
    expect(mockPost).toHaveBeenCalledWith(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent`,
      {
        model: 'models/gemini-embedding-001',
        content: {
          parts: [{ text: 'Hello world' }],
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        timeout: 10000,
      }
    );
  });

  it('should handle API errors gracefully', async () => {
    const service = new GoogleEmbeddingService({ apiKey });
    vi.spyOn(axios, 'post').mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: 'Internal Server Error' },
    });

    await expect(service.generateEmbedding('Hello world')).rejects.toThrow('Google API server error (500) - try again later: "Internal Server Error"');
  });

  it('should use custom endpoint if provided', async () => {
    const service = new GoogleEmbeddingService({ apiKey, apiEndpoint: 'https://custom-endpoint' });
    const mockEmbedding = {
      embedding: {
        values: Array.from({ length: 3072 }, (_, i) => i * 0.001),
      },
    };
    const mockPost = vi.spyOn(axios, 'post').mockResolvedValue({ data: mockEmbedding });

    await service.generateEmbedding('Hello world');
    expect(mockPost).toHaveBeenCalledWith(
      `https://custom-endpoint`,
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-goog-api-key': apiKey,
        }),
      })
    );
  });

  it('should generate embeddings for multiple texts', async () => {
    const service = new GoogleEmbeddingService({ apiKey });
    const mockEmbedding = {
      embedding: {
        values: Array.from({ length: 3072 }, (_, i) => i * 0.001),
      },
    };
    const mockPost = vi.spyOn(axios, 'post').mockResolvedValue({ data: mockEmbedding });

    const embeddings = await service.generateEmbeddings(['Hello world', 'How are you?']);
    expect(embeddings).toBeInstanceOf(Array);
    expect(embeddings.length).toBe(2);
    expect(embeddings[0].length).toBe(3072);
    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it('should not pass output_dimensionality when ENABLE_CUSTOM_DIMENSIONS is not true', async () => {
    const service = new GoogleEmbeddingService({ apiKey, dimensions: 1024 });
    process.env.ENABLE_CUSTOM_DIMENSIONS = 'false';
    const mockEmbedding = {
      embedding: {
        values: Array.from({ length: 1024 }, (_, i) => i * 0.001),
      },
    };
    const mockPost = vi.spyOn(axios, 'post').mockResolvedValue({ data: mockEmbedding });

    await service.generateEmbedding('test');

    expect(mockPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.objectContaining({ output_dimensionality: 1024 }),
      expect.any(Object)
    );
  });

  it('should pass output_dimensionality when ENABLE_CUSTOM_DIMENSIONS is true', async () => {
    const service = new GoogleEmbeddingService({ apiKey, dimensions: 1024 });
    process.env.ENABLE_CUSTOM_DIMENSIONS = 'true';
    const mockEmbedding = {
      embedding: {
        values: Array.from({ length: 1024 }, (_, i) => i * 0.001),
      },
    };
    const mockPost = vi.spyOn(axios, 'post').mockResolvedValue({ data: mockEmbedding });

    await service.generateEmbedding('test');

    expect(mockPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ output_dimensionality: 1024 }),
      expect.any(Object)
    );
  });
});
