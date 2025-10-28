import { describe, it, expect, beforeEach } from 'vitest';
import { EmbeddingServiceFactory } from '../EmbeddingServiceFactory';
import { GoogleEmbeddingService } from '../GoogleEmbeddingService';
import { OpenAIEmbeddingService } from '../OpenAIEmbeddingService';
import { DefaultEmbeddingService } from '../DefaultEmbeddingService';

describe('EmbeddingServiceFactory', () => {
  beforeEach(() => {
    // Reset environment variables before each test
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.EMBEDDING_MODEL;
    delete process.env.MOCK_EMBEDDINGS;
  });

  it('should create a GoogleEmbeddingService when GOOGLE_API_KEY is provided', () => {
    process.env.GOOGLE_API_KEY = 'test-google-api-key';
    const service = EmbeddingServiceFactory.createFromEnvironment();
    expect(service).toBeInstanceOf(GoogleEmbeddingService);
  });

  it('should create an OpenAIEmbeddingService when OPENAI_API_KEY is provided', () => {
    process.env.OPENAI_API_KEY = 'test-openai-api-key';
    const service = EmbeddingServiceFactory.createFromEnvironment();
    expect(service).toBeInstanceOf(OpenAIEmbeddingService);
  });

  it('should create a DefaultEmbeddingService when no API key is provided', () => {
    const service = EmbeddingServiceFactory.createFromEnvironment();
    expect(service).toBeInstanceOf(DefaultEmbeddingService);
  });

  it('should prioritize Google service when model name indicates Google', () => {
    process.env.GOOGLE_API_KEY = 'test-google-api-key';
    process.env.OPENAI_API_KEY = 'test-openai-api-key';
    process.env.EMBEDDING_MODEL = 'models/embedding-001';
    const service = EmbeddingServiceFactory.createFromEnvironment();
    expect(service).toBeInstanceOf(GoogleEmbeddingService);
  });

  it('should prioritize OpenAI service when model name indicates OpenAI', () => {
    process.env.GOOGLE_API_KEY = 'test-google-api-key';
    process.env.OPENAI_API_KEY = 'test-openai-api-key';
    process.env.EMBEDDING_MODEL = 'text-embedding-3-small';
    const service = EmbeddingServiceFactory.createFromEnvironment();
    expect(service).toBeInstanceOf(OpenAIEmbeddingService);
  });

  it('should pass dimensions to the Google service', () => {
    process.env.GOOGLE_API_KEY = 'test-google-api-key';
    process.env.EMBEDDING_DIMENSIONS = '1024';
    const service = EmbeddingServiceFactory.createFromEnvironment() as GoogleEmbeddingService;
    expect(service.getModelInfo().dimensions).toBe(1024);
  });

  it('should pass dimensions to the OpenAI service', () => {
    process.env.OPENAI_API_KEY = 'test-openai-api-key';
    process.env.EMBEDDING_DIMENSIONS = '512';
    const service = EmbeddingServiceFactory.createFromEnvironment() as OpenAIEmbeddingService;
    expect(service.getModelInfo().dimensions).toBe(512);
  });

  it('should pass apiEndpoint to the Google service', () => {
    process.env.GOOGLE_API_KEY = 'test-google-api-key';
    process.env.EMBEDDING_ENDPOINT = 'https://my-custom-endpoint.com';
    const service = EmbeddingServiceFactory.createFromEnvironment() as GoogleEmbeddingService;
    // This is a bit of a hack, but we don't have a public getter for the endpoint
    expect((service as any).apiEndpoint).toBe('https://my-custom-endpoint.com');
  });

  it('should pass apiEndpoint to the OpenAI service', () => {
    process.env.OPENAI_API_KEY = 'test-openai-api-key';
    process.env.EMBEDDING_ENDPOINT = 'https://my-custom-openai-endpoint.com';
    const service = EmbeddingServiceFactory.createFromEnvironment() as OpenAIEmbeddingService;
    // This is a bit of a hack, but we don't have a public getter for the endpoint
    expect((service as any).apiEndpoint).toBe('https://my-custom-openai-endpoint.com');
  });
});
