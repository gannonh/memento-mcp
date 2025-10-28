## Neo4j Storage Backend

Memento MCP provides a Neo4j storage backend that offers a unified solution for both graph storage and vector search capabilities. This integration leverages Neo4j's native graph database features and vector search functionality to deliver efficient knowledge graph operations.

### Why Neo4j?

- **Unified Storage**: Consolidates both graph and vector storage into a single database
- **Native Graph Operations**: Built specifically for graph traversal and queries
- **Integrated Vector Search**: Vector similarity search for embeddings built directly into Neo4j
- **Scalability**: Better performance with large knowledge graphs
- **Simplified Architecture**: Clean design with a single database for all operations

### Prerequisites

- Docker and Docker Compose for running Neo4j
- Neo4j 5.13+ (required for vector search capabilities)

### Neo4j Setup with Docker

The project includes a Docker Compose configuration for Neo4j:

```bash
# Start Neo4j container
docker-compose up -d neo4j

# Stop Neo4j container
docker-compose stop neo4j

# Remove Neo4j container (preserves data)
docker-compose rm neo4j
```

The Neo4j database will be available at:

- **Bolt URI**: `bolt://localhost:7687` (for driver connections)
- **HTTP**: `http://localhost:7474` (for Neo4j Browser UI)
- **Default credentials**: username: `neo4j`, password: `memento_password`

### Neo4j CLI Utilities

Memento MCP provides command-line utilities for managing Neo4j operations:

#### Testing Connection

Test the connection to your Neo4j database:

```bash
# Test with default settings
npm run neo4j:test

# Test with custom settings
npm run neo4j:test -- --uri bolt://custom-host:7687 --username myuser --password mypass
```

#### Initializing Schema

Initialize the Neo4j schema with required constraints and indexes:

```bash
# Initialize with default settings
npm run neo4j:init

# Initialize with custom vector dimensions
npm run neo4j:init -- --dimensions 768 --similarity euclidean

# Force recreation of all constraints and indexes
npm run neo4j:init -- --recreate

# Combine multiple options
npm run neo4j:init -- --vector-index custom_index --dimensions 384 --recreate
```

### Configuration Options

Neo4j support can be configured with these environment variables:

```bash
# Neo4j Connection Settings
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=memento_password
NEO4J_DATABASE=neo4j

# Vector Search Configuration
NEO4J_VECTOR_INDEX=entity_embeddings
NEO4J_VECTOR_DIMENSIONS=1536
NEO4J_SIMILARITY_FUNCTION=cosine

# Embedding Service Configuration
- `MEMORY_STORAGE_TYPE`: The storage type to use. Currently, only `neo4j` is supported.
- `OPENAI_API_KEY`: Your OpenAI API key. For local models (e.g., Ollama, LM Studio), you can set this to any non-empty string like `"ollama"`.
- `GOOGLE_API_KEY`: Your Google API key.
- `EMBEDDING_MODEL`: The embedding model to use (e.g., `text-embedding-3-small`, `models/embedding-001`).
- `EMBEDDING_DIMENSIONS`: The dimensions of the embeddings. **Important:** This value must match the dimensions of your selected model and the `NEO4J_VECTOR_DIMENSIONS`. Set this to the default dimensions of your embedding model. If your model supports other dimensions you MUST also enable `ENABLE_CUSTOM_DIMENSIONS`.
- `EMBEDDING_ENDPOINT`: Optional custom endpoint for OpenAI-compatible APIs (e.g., `http://localhost:1234/v1/embeddings` for a local model server).
- `ENABLE_CUSTOM_DIMENSIONS`: Set to `true` or `false`. Controls whether the `dimensions` (for OpenAI and compatible) or `output_dimensionality` (for Google) parameter is passed in the API request. Some models don't support this. Defaults to `false`.

# Optional Diagnostic Settings
DEBUG=true
```

Or directly in the Claude Desktop configuration:

```json
{
  "mcpServers": {
    "memento": {
      "command": "/path/to/node",
      "args": ["/path/to/memento-mcp/dist/index.js"],
      "env": {
        "MEMORY_STORAGE_TYPE": "neo4j",
        "NEO4J_URI": "bolt://localhost:7687",
        "NEO4J_USERNAME": "neo4j",
        "NEO4J_PASSWORD": "memento_password",
        "NEO4J_DATABASE": "neo4j",
        "NEO4J_VECTOR_INDEX": "entity_embeddings",
        "NEO4J_VECTOR_DIMENSIONS": "1536",
        "NEO4J_SIMILARITY_FUNCTION": "cosine",
        "OPENAI_API_KEY": "your-openai-api-key",
        "GOOGLE_API_KEY": "your-google-api-key",
        "EMBEDDING_MODEL": "text-embedding-3-small",
        "EMBEDDING_ENDPOINT": "https://your-custom-endpoint/v1/embeddings",
        "DEBUG": "true"
      }
    }
  }
}
```

#### Command Line Options

The Neo4j CLI tools support the following options:

```
--uri <uri>              Neo4j server URI (default: bolt://localhost:7687)
--username <username>    Neo4j username (default: neo4j)
--password <password>    Neo4j password (default: memento_password)
--database <name>        Neo4j database name (default: neo4j)
--vector-index <name>    Vector index name (default: entity_embeddings)
--dimensions <number>    Vector dimensions (default: 1536)
--similarity <function>  Similarity function (cosine|euclidean) (default: cosine)
--recreate               Force recreation of constraints and indexes
--no-debug               Disable detailed output (debug is ON by default)
```

#### Embedding Service Configuration

For vector search functionality, an embedding service is required:

- `OPENAI_API_KEY`: Your OpenAI API key.
- `GOOGLE_API_KEY`: Your Google API key.
- `EMBEDDING_MODEL`: The embedding model to use (e.g., `text-embedding-3-small`, `gemini-embedding-001`).
- `EMBEDDING_ENDPOINT`: Optional custom endpoint for compatible APIs.

#### Optional Configuration

- `DEBUG`: Set to `true` to enable detailed diagnostic information in the response

### Vector Search Implementation

Memento MCP implements vector search using Neo4j's built-in vector index capabilities:

1. **Entity Embeddings**: Each entity in the knowledge graph can have an associated vector embedding generated from its observations using OpenAI's embedding models
2. **Vector Index**: The system creates and maintains a vector index over entity embeddings for efficient similarity search
3. **Semantic Search**: The `semantic_search` MCP tool leverages these vector embeddings to find semantically similar entities based on meaning rather than just keywords

#### Vector Search Query Structure

The system uses Neo4j's `db.index.vector.queryNodes` procedure for vector search:

```cypher
CALL db.index.vector.queryNodes(
  'entity_embeddings',  // Index name
  $limit,               // Number of results to return
  $embedding            // Query vector
)
YIELD node, score
RETURN node.name AS name, node.entityType AS entityType, score
ORDER BY score DESC
```

### Troubleshooting Vector Search

If you encounter issues with vector search:

1. **Check vector index status**

   Use the Neo4j Browser to confirm the index is ONLINE:

   ```cypher
   SHOW VECTOR INDEXES WHERE name = 'entity_embeddings' YIELD name, state
   ```

2. **Verify entities have embeddings**

   Check if entities have valid embeddings:

   ```cypher
   MATCH (e:Entity)
   WHERE e.embedding IS NOT NULL
   RETURN count(e) as entitiesWithEmbeddings
   ```

3. **Reinitialize the schema**

   Force recreation of the vector index:

   ```bash
   npm run neo4j:init -- --recreate
   ```

4. **Run MCP diagnostic tools**

   Use the `diagnose_vector_search` MCP tool to check index status and embedding counts.

5. **Debug vector search execution**

   Enable detailed logging by setting the `DEBUG` environment variable to `true`

### Vector Search Diagnostics

The system includes built-in diagnostic capabilities for troubleshooting vector search issues:

- **Index Status Check**: Verifies that the vector index exists and is in the ONLINE state
- **Embedding Verification**: Checks if entities have valid embeddings
- **Query Vector Validation**: Ensures query vectors have valid dimensions and non-zero L2-norm
- **Fallback Search**: If vector search fails, the system falls back to text-based search
- **Detailed Logging**: Comprehensive logging of vector search operations

### Debug Tools

When the `DEBUG` environment variable is set to `true`, additional diagnostic tools become available through the MCP API. These tools are conditionally exposed only in debug mode and are not available in normal operation.

#### Available Debug Tools (DEBUG=true only)

- **diagnose_vector_search**: Bypasses application abstractions to directly query Neo4j for entity embeddings and index status

  ```
  # Returns count of entities with embeddings, sample entities, index status, and test query results
  ```

- **force_generate_embedding**: Forces the generation and storage of an embedding for a specific entity

  ```json
  {
    "entity_name": "EntityName"
  }
  ```

  _Note: This tool may be deprecated in future releases as embedding generation becomes more automated_

- **debug_embedding_config**: Provides information about the current embedding service configuration

  ```
  # Shows embedding model, dimensions, and service status
  ```

#### Diagnostic Response Format

When debug mode is enabled, semantic search responses include additional diagnostic information:

```json
{
  "entities": [...],
  "relations": [...],
  "diagnostics": {
    "query": "original search query",
    "startTime": 1743279841982,
    "stepsTaken": [
      { "step": "embeddingServiceCheck", "status": "available", ... },
      { "step": "vectorSearch", "status": "started", ... },
      { "step": "vectorSearch", "status": "completed", "resultsCount": 3 }
    ],
    "endTime": 1743279842014,
    "totalTimeTaken": 32
  }
}
```

#### Enabling Debug Mode

To enable debug tools and detailed diagnostics:

1. Set the `DEBUG` environment variable to `true`:

   ```bash
   DEBUG=true
   ```

2. Or add it to your Claude Desktop configuration:

   ```json
   "env": {
     "DEBUG": "true",
     // other environment variables
   }
   ```

Upon setting DEBUG=true:

- The three debug tools will be exposed in the MCP API tools list
- Diagnostic information will be included in responses
- Vector search operations will log detailed steps and metrics

> ⚠️ **NOTE**: Debug mode is intended for development and troubleshooting only. When DEBUG is not set to 'true', these tools will not be available in the MCP API.

### Developer Notes

#### Full Database Reset

If you need to completely reset your Neo4j database during development:

```bash
# Stop the container
docker-compose stop neo4j

# Remove the container
docker-compose rm -f neo4j

# Delete the data directory
rm -rf ./neo4j-data/*

# Restart the container
docker-compose up -d neo4j

# Reinitialize the schema
npm run neo4j:init
```
