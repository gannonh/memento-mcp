import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { EmbeddingServiceFactory } from '../EmbeddingServiceFactory.js';
import { GoogleEmbeddingService } from '../GoogleEmbeddingService.js';
import { OpenAIEmbeddingService } from '../OpenAIEmbeddingService.js';
import { DefaultEmbeddingService } from '../DefaultEmbeddingService.js';

// Load environment variables from .env file
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const hasGoogleApiKey = !!process.env.GOOGLE_API_KEY;
const hasOpenAiApiKey = !!process.env.OPENAI_API_KEY;
const testIntegration = process.env.TEST_INTEGRATION === 'true';

const conditionalGoogleTest = hasGoogleApiKey && testIntegration ? it : it.skip;
const conditionalOpenAiTest = hasOpenAiApiKey && testIntegration ? it : it.skip;

describe('Dimension Passing Integration Test', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Reset the factory to ensure a clean state for each test
    EmbeddingServiceFactory.resetRegistry();
    EmbeddingServiceFactory.registerProvider('google', (config) => new GoogleEmbeddingService({
      apiKey: config?.apiKey || process.env.GOOGLE_API_KEY!,
      model: config?.model,
      dimensions: config?.dimensions,
      apiEndpoint: config?.apiEndpoint,
    }));
    EmbeddingServiceFactory.registerProvider('openai', (config) => new OpenAIEmbeddingService({
      apiKey: config?.apiKey || process.env.OPENAI_API_KEY!,
      model: config?.model,
      dimensions: config?.dimensions,
      apiEndpoint: config?.apiEndpoint,
    }));
    EmbeddingServiceFactory.registerProvider('default', () => new DefaultEmbeddingService());
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should pass output_dimensionality to GoogleEmbeddingService when configured via environment variables', async () => {
    // Setup environment variables for Google
    process.env.EMBEDDING_MODEL = 'embedding-001';
    process.env.EMBEDDING_DIMENSIONS = '1024';
    process.env.ENABLE_CUSTOM_DIMENSIONS = 'true';
    process.env.GOOGLE_API_KEY = 'test-google-key';
    delete process.env.OPENAI_API_KEY; // Remove OpenAI key completely

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Mock axios.post call to prevent actual API calls
    const axiosPostSpy = vi.spyOn(axios, 'post').mockResolvedValue({
      data: {
        embedding: {
          values: new Array(1024).fill(0.1)
        }
      }
    });

    // Use createFromEnvironment to test environment variable logic
    const service = EmbeddingServiceFactory.createFromEnvironment();
    expect(service).toBeInstanceOf(GoogleEmbeddingService);

    await service.generateEmbedding('test');

    // Check the console log for the payload
    const consoleOutputLines = consoleSpy.mock.calls.map(call => call.join(' '));
    expect(consoleOutputLines.join('\n')).toContain('Google Payload:');
    // Check for the actual dimension value in JSON string
    expect(consoleOutputLines.some(line => line.includes('"output_dimensionality": 1024'))).toBe(true);

    // Verify the axios call was made with the correct payload
    expect(axiosPostSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        model: 'models/embedding-001',
        content: {
          parts: [{ text: 'test' }]
        },
        output_dimensionality: 1024
      }),
      expect.any(Object)
    );

    axiosPostSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('should pass dimensions to OpenAIEmbeddingService when configured via environment variables', async () => {
    // Setup environment variables for OpenAI
    process.env.EMBEDDING_MODEL = 'text-embedding-3-small';
    process.env.EMBEDDING_DIMENSIONS = '512';
    process.env.ENABLE_CUSTOM_DIMENSIONS = 'true';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    delete process.env.GOOGLE_API_KEY; // Remove Google key completely

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Mock axios.post call to prevent actual API calls
    const axiosPostSpy = vi.spyOn(axios, 'post').mockResolvedValue({
      data: {
        data: [{
          embedding: new Array(512).fill(0.1),
          index: 0,
          object: 'embedding'
        }]
      }
    });

    // Use createFromEnvironment to test environment variable logic
    const service = EmbeddingServiceFactory.createFromEnvironment();
    expect(service).toBeInstanceOf(OpenAIEmbeddingService);

    await service.generateEmbedding('test');

    // Check the console log for the payload
    const consoleOutputLines = consoleSpy.mock.calls.map(call => call.join(' '));
    expect(consoleOutputLines.join('\n')).toContain('OpenAI Payload:');
    // Check for the actual dimension value in JSON string
    expect(consoleOutputLines.some(line => line.includes('"dimensions": 512'))).toBe(true);

    // Verify the axios call was made with the correct payload
    expect(axiosPostSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        input: 'test',
        model: 'text-embedding-3-small',
        dimensions: 512
      }),
      expect.any(Object)
    );

    axiosPostSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('should pass output_dimensionality to GoogleEmbeddingService when using createService with explicit provider', async () => {
    // Set ENABLE_CUSTOM_DIMENSIONS for explicit provider test
    process.env.ENABLE_CUSTOM_DIMENSIONS = 'true';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Mock axios.post call to prevent actual API calls
    const axiosPostSpy = vi.spyOn(axios, 'post').mockResolvedValue({
      data: {
        embedding: {
          values: new Array(1024).fill(0.1)
        }
      }
    });

    // Use createService with explicit provider and config
    const service = EmbeddingServiceFactory.createService({
      provider: 'google',
      apiKey: 'test-google-key',
      model: 'embedding-001',
      dimensions: 1024,
    });
    expect(service).toBeInstanceOf(GoogleEmbeddingService);

    await service.generateEmbedding('test');

    // Check the console log for the payload
    const consoleOutputLines = consoleSpy.mock.calls.map(call => call.join(' '));
    expect(consoleOutputLines.join('\n')).toContain('Google Payload:');
    // Check for the actual dimension value in JSON string
    expect(consoleOutputLines.some(line => line.includes('"output_dimensionality": 1024'))).toBe(true);

    // Verify the axios call was made with the correct payload
    expect(axiosPostSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        model: 'models/embedding-001',
        content: {
          parts: [{ text: 'test' }]
        },
        output_dimensionality: 1024
      }),
      expect.any(Object)
    );

    axiosPostSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('should pass dimensions to OpenAIEmbeddingService when using createService with explicit provider', async () => {
    // Set ENABLE_CUSTOM_DIMENSIONS for explicit provider test
    process.env.ENABLE_CUSTOM_DIMENSIONS = 'true';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Mock axios.post call to prevent actual API calls
    const axiosPostSpy = vi.spyOn(axios, 'post').mockResolvedValue({
      data: {
        data: [{
          embedding: new Array(512).fill(0.1),
          index: 0,
          object: 'embedding'
        }]
      }
    });

    // Use createService with explicit provider and config
    const service = EmbeddingServiceFactory.createService({
      provider: 'openai',
      apiKey: 'test-openai-key',
      model: 'text-embedding-3-small',
      dimensions: 512,
    });
    expect(service).toBeInstanceOf(OpenAIEmbeddingService);

    await service.generateEmbedding('test');

    // Check the console log for the payload
    const consoleOutputLines = consoleSpy.mock.calls.map(call => call.join(' '));
    expect(consoleOutputLines.join('\n')).toContain('OpenAI Payload:');
    // Check for the actual dimension value in JSON string
    expect(consoleOutputLines.some(line => line.includes('"dimensions": 512'))).toBe(true);

    // Verify the axios call was made with the correct payload
    expect(axiosPostSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        input: 'test',
        model: 'text-embedding-3-small',
        dimensions: 512
      }),
      expect.any(Object)
    );

    axiosPostSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  conditionalGoogleTest('should return an embedding with the correct dimensions from live Google API', async () => {
    // Setup environment for Google API test
    process.env.EMBEDDING_MODEL = 'gemini-embedding-001';
    process.env.EMBEDDING_DIMENSIONS = '256'; // A smaller, valid dimension for testing
    process.env.ENABLE_CUSTOM_DIMENSIONS = 'true';
    delete process.env.OPENAI_API_KEY; // Ensure OpenAI is not selected

    const service = EmbeddingServiceFactory.createFromEnvironment();
    expect(service).toBeInstanceOf(GoogleEmbeddingService);

    const embedding = await service.generateEmbedding('live api test');
    expect(embedding).toBeInstanceOf(Array);
    expect(embedding.length).toBe(256);
  }, 30000); // 30s timeout for live API call

  conditionalOpenAiTest('should return an embedding with the correct dimensions from live OpenAI API', async () => {
    // Setup environment for OpenAI API test
    process.env.EMBEDDING_MODEL = 'text-embedding-3-small';
    process.env.EMBEDDING_DIMENSIONS = '512';
    process.env.ENABLE_CUSTOM_DIMENSIONS = 'true';
    delete process.env.GOOGLE_API_KEY; // Ensure Google is not selected

    const service = EmbeddingServiceFactory.createFromEnvironment();
    expect(service).toBeInstanceOf(OpenAIEmbeddingService);

    const embedding = await service.generateEmbedding('live api test');
    expect(embedding).toBeInstanceOf(Array);
    expect(embedding.length).toBe(512);
  }, 30000); // 30s timeout for live API call
});
