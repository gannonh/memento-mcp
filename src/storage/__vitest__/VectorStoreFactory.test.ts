import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VectorStoreFactory, VectorStoreType } from '../VectorStoreFactory.js';
import { Neo4jVectorStore } from '../neo4j/Neo4jVectorStore.js';
import { Neo4jConnectionManager } from '../neo4j/Neo4jConnectionManager.js';

// Create mock objects that track their initialization
const mockNeo4jInitialize = vi.fn().mockResolvedValue(undefined);

// Mock the dependencies
vi.mock('../neo4j/Neo4jVectorStore.js', () => {
  const MockNeo4jVectorStore = vi.fn().mockImplementation(() => ({
    initialize: mockNeo4jInitialize,
    addVector: vi.fn().mockResolvedValue(undefined),
    removeVector: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
  }));
  return { Neo4jVectorStore: MockNeo4jVectorStore };
});

vi.mock('../neo4j/Neo4jConnectionManager.js', () => {
  const MockNeo4jConnectionManager = vi.fn().mockImplementation(() => ({
    getSession: vi.fn().mockResolvedValue({
      close: vi.fn().mockResolvedValue(undefined),
    }),
    close: vi.fn().mockResolvedValue(undefined),
  }));
  return { Neo4jConnectionManager: MockNeo4jConnectionManager };
});

describe('VectorStoreFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a Neo4jVectorStore instance by default', async () => {
    // We need to provide neo4jConfig because it's required
    const defaultNeo4jConfig = {
      uri: 'bolt://localhost:7687',
      username: 'neo4j',
      password: 'password',
      database: 'neo4j',
      vectorIndexName: 'entity_embeddings',
      vectorDimensions: 1536,
      similarityFunction: 'cosine' as const,
    };

    const vectorStore = await VectorStoreFactory.createVectorStore({
      neo4jConfig: defaultNeo4jConfig,
    });

    expect(vectorStore).toBeDefined();
    expect(Neo4jConnectionManager).toHaveBeenCalledWith(defaultNeo4jConfig);
    expect(Neo4jVectorStore).toHaveBeenCalledWith({
      connectionManager: expect.any(Object),
      indexName: 'entity_embeddings',
      dimensions: 1536,
      similarityFunction: 'cosine',
    });
    // Check that Neo4jVectorStore constructor was called
    expect(Neo4jVectorStore).toHaveBeenCalledTimes(1);
  });

  it('should create a Neo4jVectorStore instance with custom options', async () => {
    const neo4jConfig = {
      uri: 'bolt://localhost:7687',
      username: 'neo4j',
      password: 'password',
      database: 'test_db',
      vectorIndexName: 'test_index',
      vectorDimensions: 1536,
      similarityFunction: 'cosine' as const,
    };

    const vectorStore = await VectorStoreFactory.createVectorStore({
      type: 'neo4j',
      neo4jConfig,
      indexName: 'custom_index',
      dimensions: 3072,
      similarityFunction: 'euclidean',
    });

    expect(vectorStore).toBeDefined();
    expect(Neo4jConnectionManager).toHaveBeenCalledWith(neo4jConfig);
    expect(Neo4jVectorStore).toHaveBeenCalledWith({
      connectionManager: expect.any(Object),
      indexName: 'custom_index',
      dimensions: 3072,
      similarityFunction: 'euclidean',
    });
    // Check that Neo4jVectorStore constructor was called
    expect(Neo4jVectorStore).toHaveBeenCalledTimes(1);
  });

  it('should throw an error when creating Neo4jVectorStore without config', async () => {
    await expect(
      VectorStoreFactory.createVectorStore({
        type: 'neo4j',
      })
    ).rejects.toThrow('Neo4j configuration is required for Neo4j vector store');
  });

  it('should throw an error for unsupported vector store types', async () => {
    await expect(
      VectorStoreFactory.createVectorStore({
        type: 'invalid' as VectorStoreType,
      })
    ).rejects.toThrow('Unsupported vector store type: invalid');
  });

  it('should initialize the Neo4j vector store when initializeImmediately is true', async () => {
    await VectorStoreFactory.createVectorStore({
      type: 'neo4j',
      neo4jConfig: {
        uri: 'bolt://localhost:7687',
        username: 'neo4j',
        password: 'password',
        database: 'neo4j',
        vectorIndexName: 'entity_embeddings',
        vectorDimensions: 1536,
        similarityFunction: 'cosine' as const,
      },
      initializeImmediately: true,
    });

    // Verify initialize was called
    expect(mockNeo4jInitialize).toHaveBeenCalledTimes(1);
  });

  it('should not initialize the Neo4j vector store when initializeImmediately is false', async () => {
    await VectorStoreFactory.createVectorStore({
      type: 'neo4j',
      neo4jConfig: {
        uri: 'bolt://localhost:7687',
        username: 'neo4j',
        password: 'password',
        database: 'neo4j',
        vectorIndexName: 'entity_embeddings',
        vectorDimensions: 1536,
        similarityFunction: 'cosine' as const,
      },
      initializeImmediately: false,
    });

    // Verify initialize was not called
    expect(mockNeo4jInitialize).not.toHaveBeenCalled();
  });
});
