[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/gannonh-memento-mcp-badge.png)](https://mseep.ai/app/gannonh-memento-mcp)

# Memento MCP: A Knowledge Graph Memory System for LLMs

![Memento MCP Logo](assets/memento-logo-gray.svg)

Scalable, high performance knowledge graph memory system with semantic retrieval, contextual recall, and temporal awareness. Provides any LLM client that supports the model context protocol (e.g., Claude Desktop, Cursor, Github Copilot) with resilient, adaptive, and persistent long-term ontological memory.

[![Memento MCP Tests](https://github.com/gannonh/memento-mcp/actions/workflows/memento-mcp.yml/badge.svg)](https://github.com/gannonh/memento-mcp/actions/workflows/memento-mcp.yml)
[![smithery badge](https://smithery.ai/badge/@gannonh/memento-mcp)](https://smithery.ai/server/@gannonh/memento-mcp)

## Core Concepts

### Entities

Entities are the primary nodes in the knowledge graph. Each entity has:

- A unique name (identifier)
- An entity type (e.g., "person", "organization", "event")
- A list of observations
- Vector embeddings (for semantic search)
- Complete version history

Example:

```json
{
  "name": "John_Smith",
  "entityType": "person",
  "observations": ["Speaks fluent Spanish"]
}
```

### Relations

Relations define directed connections between entities with enhanced properties:

- Strength indicators (0.0-1.0)
- Confidence levels (0.0-1.0)
- Rich metadata (source, timestamps, tags)
- Temporal awareness with version history
- Time-based confidence decay

Example:

```json
{
  "from": "John_Smith",
  "to": "Anthropic",
  "relationType": "works_at",
  "strength": 0.9,
  "confidence": 0.95,
  "metadata": {
    "source": "linkedin_profile",
    "last_verified": "2025-03-21"
  }
}
```

## Storage Backend

Memento MCP uses Neo4j as its storage backend, providing a unified solution for both graph storage and vector search capabilities.

### Why Neo4j?

- **Unified Storage**: Consolidates both graph and vector storage into a single database
- **Native Graph Operations**: Built specifically for graph traversal and queries
- **Integrated Vector Search**: Vector similarity search for embeddings built directly into Neo4j
- **Scalability**: Better performance with large knowledge graphs
- **Simplified Architecture**: Clean design with a single database for all operations

### Prerequisites

- Neo4j 5.13+ (required for vector search capabilities)

### Neo4j Desktop Setup (Recommended)

The easiest way to get started with Neo4j is to use [Neo4j Desktop](https://neo4j.com/download/):

1. Download and install Neo4j Desktop from <https://neo4j.com/download/>
2. Create a new project
3. Add a new database
4. Set password to `memento_password` (or your preferred password)
5. Start the database

The Neo4j database will be available at:

- **Bolt URI**: `bolt://127.0.0.1:7687` (for driver connections)
- **HTTP**: `http://127.0.0.1:7474` (for Neo4j Browser UI)
- **Default credentials**: username: `neo4j`, password: `memento_password` (or whatever you configured)

### Neo4j Setup with Docker (Alternative)

Alternatively, you can use Docker Compose to run Neo4j:

```bash
# Start Neo4j container
docker-compose up -d neo4j

# Stop Neo4j container
docker-compose stop neo4j

# Remove Neo4j container (preserves data)
docker-compose rm neo4j
```

When using Docker, the Neo4j database will be available at:

- **Bolt URI**: `bolt://127.0.0.1:7687` (for driver connections)
- **HTTP**: `http://127.0.0.1:7474` (for Neo4j Browser UI)
- **Default credentials**: username: `neo4j`, password: `memento_password`

#### Data Persistence and Management

Neo4j data persists across container restarts and even version upgrades due to the Docker volume configuration in the `docker-compose.yml` file:

```yaml
volumes:
  - ./neo4j-data:/data
  - ./neo4j-logs:/logs
  - ./neo4j-import:/import
```

These mappings ensure that:

- `/data` directory (contains all database files) persists on your host at `./neo4j-data`
- `/logs` directory persists on your host at `./neo4j-logs`
- `/import` directory (for importing data files) persists at `./neo4j-import`

You can modify these paths in your `docker-compose.yml` file to store data in different locations if needed.

##### Upgrading Neo4j Version

You can change Neo4j editions and versions without losing data:

1. Update the Neo4j image version in `docker-compose.yml`
2. Restart the container with `docker-compose down && docker-compose up -d neo4j`
3. Reinitialize the schema with `npm run neo4j:init`

The data will persist through this process as long as the volume mappings remain the same.

##### Complete Database Reset

If you need to completely reset your Neo4j database:

```bash
# Stop the container
docker-compose stop neo4j

# Remove the container
docker-compose rm -f neo4j

# Delete the data directory contents
rm -rf ./neo4j-data/*

# Restart the container
docker-compose up -d neo4j

# Reinitialize the schema
npm run neo4j:init
```

##### Backing Up Data

To back up your Neo4j data, you can simply copy the data directory:

```bash
# Make a backup of the Neo4j data
cp -r ./neo4j-data ./neo4j-data-backup-$(date +%Y%m%d)
```

### Neo4j CLI Utilities

Memento MCP includes command-line utilities for managing Neo4j operations:

#### Testing Connection

Test the connection to your Neo4j database:

```bash
# Test with default settings
npm run neo4j:test

# Test with custom settings
npm run neo4j:test -- --uri bolt://127.0.0.1:7687 --username myuser --password mypass --database neo4j
```

#### Initializing Schema

For normal operation, Neo4j schema initialization happens automatically when Memento MCP connects to the database. You don't need to run any manual commands for regular usage.

The following commands are only necessary for development, testing, or advanced customization scenarios:

```bash
# Initialize with default settings (only needed for development or troubleshooting)
npm run neo4j:init

# Initialize with custom vector dimensions
npm run neo4j:init -- --dimensions 768 --similarity euclidean

# Force recreation of all constraints and indexes
npm run neo4j:init -- --recreate

# Combine multiple options
npm run neo4j:init -- --vector-index custom_index --dimensions 384 --recreate
```

## Advanced Features

### Semantic Search

Find semantically related entities based on meaning rather than just keywords:

- **Vector Embeddings**: Entities are automatically encoded into high-dimensional vector space using OpenAI's embedding models
- **Cosine Similarity**: Find related concepts even when they use different terminology
- **Configurable Thresholds**: Set minimum similarity scores to control result relevance
- **Cross-Modal Search**: Query with text to find relevant entities regardless of how they were described
- **Multi-Model Support**: Compatible with multiple embedding models (OpenAI text-embedding-3-small/large)
- **Contextual Retrieval**: Retrieve information based on semantic meaning rather than exact keyword matches
- **Optimized Defaults**: Tuned parameters for balance between precision and recall (0.6 similarity threshold, hybrid search enabled)
- **Hybrid Search**: Combines semantic and keyword search for more comprehensive results
- **Adaptive Search**: System intelligently chooses between vector-only, keyword-only, or hybrid search based on query characteristics and available data
- **Performance Optimization**: Prioritizes vector search for semantic understanding while maintaining fallback mechanisms for resilience
- **Query-Aware Processing**: Adjusts search strategy based on query complexity and available entity embeddings

### Temporal Awareness

Track complete history of entities and relations with point-in-time graph retrieval:

- **Full Version History**: Every change to an entity or relation is preserved with timestamps
- **Point-in-Time Queries**: Retrieve the exact state of the knowledge graph at any moment in the past
- **Change Tracking**: Automatically records createdAt, updatedAt, validFrom, and validTo timestamps
- **Temporal Consistency**: Maintain a historically accurate view of how knowledge evolved
- **Non-Destructive Updates**: Updates create new versions rather than overwriting existing data
- **Time-Based Filtering**: Filter graph elements based on temporal criteria
- **History Exploration**: Investigate how specific information changed over time

### Confidence Decay

Relations automatically decay in confidence over time based on configurable half-life:

- **Time-Based Decay**: Confidence in relations naturally decreases over time if not reinforced
- **Configurable Half-Life**: Define how quickly information becomes less certain (default: 30 days)
- **Minimum Confidence Floors**: Set thresholds to prevent over-decay of important information
- **Decay Metadata**: Each relation includes detailed decay calculation information
- **Non-Destructive**: Original confidence values are preserved alongside decayed values
- **Reinforcement Learning**: Relations regain confidence when reinforced by new observations
- **Reference Time Flexibility**: Calculate decay based on arbitrary reference times for historical analysis

### Advanced Metadata

Rich metadata support for both entities and relations with custom fields:

- **Source Tracking**: Record where information originated (user input, analysis, external sources)
- **Confidence Levels**: Assign confidence scores (0.0-1.0) to relations based on certainty
- **Relation Strength**: Indicate importance or strength of relationships (0.0-1.0)
- **Temporal Metadata**: Track when information was added, modified, or verified
- **Custom Tags**: Add arbitrary tags for classification and filtering
- **Structured Data**: Store complex structured data within metadata fields
- **Query Support**: Search and filter based on metadata properties
- **Extensible Schema**: Add custom fields as needed without modifying the core data model

## MCP API Tools

The following tools are available to LLM client hosts through the Model Context Protocol:

### Entity Management

- **create_entities**

  - Create multiple new entities in the knowledge graph
  - Input: `entities` (array of objects)
    - Each object contains:
      - `name` (string): Entity identifier
      - `entityType` (string): Type classification
      - `observations` (string[]): Associated observations

- **add_observations**

  - Add new observations to existing entities
  - Input: `observations` (array of objects)
    - Each object contains:
      - `entityName` (string): Target entity
      - `contents` (string[]): New observations to add

- **delete_entities**

  - Remove entities and their relations
  - Input: `entityNames` (string[])

- **delete_observations**
  - Remove specific observations from entities
  - Input: `deletions` (array of objects)
    - Each object contains:
      - `entityName` (string): Target entity
      - `observations` (string[]): Observations to remove

### Relation Management

- **create_relations**

  - Create multiple new relations between entities with enhanced properties
  - Input: `relations` (array of objects)
    - Each object contains:
      - `from` (string): Source entity name
      - `to` (string): Target entity name
      - `relationType` (string): Relationship type
      - `strength` (number, optional): Relation strength (0.0-1.0)
      - `confidence` (number, optional): Confidence level (0.0-1.0)
      - `metadata` (object, optional): Custom metadata fields

- **get_relation**

  - Get a specific relation with its enhanced properties
  - Input:
    - `from` (string): Source entity name
    - `to` (string): Target entity name
    - `relationType` (string): Relationship type

- **update_relation**

  - Update an existing relation with enhanced properties
  - Input: `relation` (object):
    - Contains:
      - `from` (string): Source entity name
      - `to` (string): Target entity name
      - `relationType` (string): Relationship type
      - `strength` (number, optional): Relation strength (0.0-1.0)
      - `confidence` (number, optional): Confidence level (0.0-1.0)
      - `metadata` (object, optional): Custom metadata fields

- **delete_relations**
  - Remove specific relations from the graph
  - Input: `relations` (array of objects)
    - Each object contains:
      - `from` (string): Source entity name
      - `to` (string): Target entity name
      - `relationType` (string): Relationship type

### Graph Operations

- **read_graph**

  - Read the entire knowledge graph
  - No input required

- **search_nodes**

  - Search for nodes based on query
  - Input: `query` (string)

- **open_nodes**
  - Retrieve specific nodes by name
  - Input: `names` (string[])

### Semantic Search

- **semantic_search**

  - Search for entities semantically using vector embeddings and similarity
  - Input:
    - `query` (string): The text query to search for semantically
    - `limit` (number, optional): Maximum results to return (default: 10)
    - `min_similarity` (number, optional): Minimum similarity threshold (0.0-1.0, default: 0.6)
    - `entity_types` (string[], optional): Filter results by entity types
    - `hybrid_search` (boolean, optional): Combine keyword and semantic search (default: true)
    - `semantic_weight` (number, optional): Weight of semantic results in hybrid search (0.0-1.0, default: 0.6)
  - Features:
    - Intelligently selects optimal search method (vector, keyword, or hybrid) based on query context
    - Gracefully handles queries with no semantic matches through fallback mechanisms
    - Maintains high performance with automatic optimization decisions

- **get_entity_embedding**
  - Get the vector embedding for a specific entity
  - Input:
    - `entity_name` (string): The name of the entity to get the embedding for

### Temporal Features

- **get_entity_history**

  - Get complete version history of an entity
  - Input: `entityName` (string)

- **get_relation_history**

  - Get complete version history of a relation
  - Input:
    - `from` (string): Source entity name
    - `to` (string): Target entity name
    - `relationType` (string): Relationship type

- **get_graph_at_time**

  - Get the state of the graph at a specific timestamp
  - Input: `timestamp` (number): Unix timestamp (milliseconds since epoch)

- **get_decayed_graph**
  - Get graph with time-decayed confidence values
  - Input: `options` (object, optional):
    - `reference_time` (number): Reference timestamp for decay calculation (milliseconds since epoch)
    - `decay_factor` (number): Optional decay factor override

## Configuration

### Environment Variables

Configure Memento MCP with these environment variables:

```bash
# Neo4j Connection Settings
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=memento_password
NEO4J_DATABASE=neo4j

# Vector Search Configuration
NEO4J_VECTOR_INDEX=entity_embeddings
NEO4J_VECTOR_DIMENSIONS=1536
NEO4J_SIMILARITY_FUNCTION=cosine

# Embedding Service Configuration
MEMORY_STORAGE_TYPE=neo4j
OPENAI_API_KEY=your-openai-api-key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Debug Settings
DEBUG=true
```

### Command Line Options

The Neo4j CLI tools support the following options:

```
--uri <uri>              Neo4j server URI (default: bolt://127.0.0.1:7687)
--username <username>    Neo4j username (default: neo4j)
--password <password>    Neo4j password (default: memento_password)
--database <n>           Neo4j database name (default: neo4j)
--vector-index <n>       Vector index name (default: entity_embeddings)
--dimensions <number>    Vector dimensions (default: 1536)
--similarity <function>  Similarity function (cosine|euclidean) (default: cosine)
--recreate               Force recreation of constraints and indexes
--no-debug               Disable detailed output (debug is ON by default)
```

### Embedding Models

Available OpenAI embedding models:

- `text-embedding-3-small`: Efficient, cost-effective (1536 dimensions)
- `text-embedding-3-large`: Higher accuracy, more expensive (3072 dimensions)
- `text-embedding-ada-002`: Legacy model (1536 dimensions)

#### OpenAI API Configuration

To use semantic search, you'll need to configure OpenAI API credentials:

1. Obtain an API key from [OpenAI](https://platform.openai.com/api-keys)
2. Configure your environment with:

```bash
# OpenAI API Key for embeddings
OPENAI_API_KEY=your-openai-api-key
# Default embedding model
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

> **Note**: For testing environments, the system will mock embedding generation if no API key is provided. However, using real embeddings is recommended for integration testing.

## Integration with Claude Desktop

### Configuration

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "memento": {
      "command": "npx",
      "args": ["-y", "@gannonh/memento-mcp"],
      "env": {
        "MEMORY_STORAGE_TYPE": "neo4j",
        "NEO4J_URI": "bolt://127.0.0.1:7687",
        "NEO4J_USERNAME": "neo4j",
        "NEO4J_PASSWORD": "memento_password",
        "NEO4J_DATABASE": "neo4j",
        "NEO4J_VECTOR_INDEX": "entity_embeddings",
        "NEO4J_VECTOR_DIMENSIONS": "1536",
        "NEO4J_SIMILARITY_FUNCTION": "cosine",
        "OPENAI_API_KEY": "your-openai-api-key",
        "OPENAI_EMBEDDING_MODEL": "text-embedding-3-small",
        "DEBUG": "true"
      }
    }
  }
}
```

Alternatively, for local development, you can use:

```json
{
  "mcpServers": {
    "memento": {
      "command": "/path/to/node",
      "args": ["/path/to/memento-mcp/dist/index.js"],
      "env": {
        "MEMORY_STORAGE_TYPE": "neo4j",
        "NEO4J_URI": "bolt://127.0.0.1:7687",
        "NEO4J_USERNAME": "neo4j",
        "NEO4J_PASSWORD": "memento_password",
        "NEO4J_DATABASE": "neo4j",
        "NEO4J_VECTOR_INDEX": "entity_embeddings",
        "NEO4J_VECTOR_DIMENSIONS": "1536",
        "NEO4J_SIMILARITY_FUNCTION": "cosine",
        "OPENAI_API_KEY": "your-openai-api-key",
        "OPENAI_EMBEDDING_MODEL": "text-embedding-3-small",
        "DEBUG": "true"
      }
    }
  }
}
```

> **Important**: Always explicitly specify the embedding model in your Claude Desktop configuration to ensure consistent behavior.

### Recommended System Prompts

For optimal integration with Claude, add these statements to your system prompt:

```
You have access to the Memento MCP knowledge graph memory system, which provides you with persistent memory capabilities.
Your memory tools are provided by Memento MCP, a sophisticated knowledge graph implementation.
When asked about past conversations or user information, always check the Memento MCP knowledge graph first.
You should use semantic_search to find relevant information in your memory when answering questions.
```

### Testing Semantic Search

Once configured, Claude can access the semantic search capabilities through natural language:

1. To create entities with semantic embeddings:

   ```
   User: "Remember that Python is a high-level programming language known for its readability and JavaScript is primarily used for web development."
   ```

2. To search semantically:

   ```
   User: "What programming languages do you know about that are good for web development?"
   ```

3. To retrieve specific information:

   ```
   User: "Tell me everything you know about Python."
   ```

The power of this approach is that users can interact naturally, while the LLM handles the complexity of selecting and using the appropriate memory tools.

### Real-World Applications

Memento's adaptive search capabilities provide practical benefits:

1. **Query Versatility**: Users don't need to worry about how to phrase questions - the system adapts to different query types automatically

2. **Failure Resilience**: Even when semantic matches aren't available, the system can fall back to alternative methods without user intervention

3. **Performance Efficiency**: By intelligently selecting the optimal search method, the system balances performance and relevance for each query

4. **Improved Context Retrieval**: LLM conversations benefit from better context retrieval as the system can find relevant information across complex knowledge graphs

For example, when a user asks "What do you know about machine learning?", the system can retrieve conceptually related entities even if they don't explicitly mention "machine learning" - perhaps entities about neural networks, data science, or specific algorithms. But if semantic search yields insufficient results, the system automatically adjusts its approach to ensure useful information is still returned.

## Troubleshooting

### Vector Search Diagnostics

Memento MCP includes built-in diagnostic capabilities to help troubleshoot vector search issues:

- **Embedding Verification**: The system checks if entities have valid embeddings and automatically generates them if missing
- **Vector Index Status**: Verifies that the vector index exists and is in the ONLINE state
- **Fallback Search**: If vector search fails, the system falls back to text-based search
- **Detailed Logging**: Comprehensive logging of vector search operations for troubleshooting

### Debug Tools (when DEBUG=true)

Additional diagnostic tools become available when debug mode is enabled:

- **diagnose_vector_search**: Information about the Neo4j vector index, embedding counts, and search functionality
- **force_generate_embedding**: Forces the generation of an embedding for a specific entity
- **debug_embedding_config**: Information about the current embedding service configuration

### Developer Reset

To completely reset your Neo4j database during development:

```bash
# Stop the container (if using Docker)
docker-compose stop neo4j

# Remove the container (if using Docker)
docker-compose rm -f neo4j

# Delete the data directory (if using Docker)
rm -rf ./neo4j-data/*

# For Neo4j Desktop, right-click your database and select "Drop database"

# Restart the database
# For Docker:
docker-compose up -d neo4j

# For Neo4j Desktop:
# Click the "Start" button for your database

# Reinitialize the schema
npm run neo4j:init
```

## Building and Development

```bash
# Clone the repository
git clone https://github.com/gannonh/memento-mcp.git
cd memento-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Check test coverage
npm run test:coverage
```

## Installation

### Installing via Smithery

To install memento-mcp for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@gannonh/memento-mcp):

```bash
npx -y @smithery/cli install @gannonh/memento-mcp --client claude
```

### Global Installation with npx

You can run Memento MCP directly using npx without installing it globally:

```bash
npx -y @gannonh/memento-mcp
```

This method is recommended for use with Claude Desktop and other MCP-compatible clients.

### Local Installation

For development or contributing to the project:

```bash
# Install locally
npm install @gannonh/memento-mcp

# Or clone the repository
git clone https://github.com/gannonh/memento-mcp.git
cd memento-mcp
npm install
```

## License

MIT
