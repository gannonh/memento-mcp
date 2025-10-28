# Changelog

All notable changes to Memento MCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2025-10-28

### Added
- Support for Google's Gemini embedding models.
- Ability to specify custom vector dimensions for both Google and OpenAI embedding services.
- New environment variables `EMBEDDING_DIMENSIONS` and `ENABLE_CUSTOM_DIMENSIONS` to control the new feature.
- Support for custom OpenAI-compatible API endpoints via the `EMBEDDING_ENDPOINT` environment variable.

### Changed
- Standardized embedding-related environment variables (`EMBEDDING_MODEL`, `EMBEDDING_ENDPOINT`) for consistency across providers.

## [0.3.9] - 2025-05-08

### Changed

- Updated dependencies to latest versions:
  - @modelcontextprotocol/sdk from 1.8.0 to 1.11.0
  - axios from 1.8.4 to 1.9.0
  - dotenv from 16.4.7 to 16.5.0
  - eslint from 9.23.0 to 9.26.0
  - eslint-config-prettier from 10.1.1 to 10.1.3
  - glob from 11.0.1 to 11.0.2
  - openai from 4.91.1 to 4.97.0
  - tsx from 4.19.3 to 4.19.4
  - typescript from 5.8.2 to 5.8.3
  - vitest and @vitest/coverage-v8 from 3.1.1 to 3.1.3
  - zod from 3.24.2 to 3.24.4
  - @typescript-eslint/eslint-plugin and @typescript-eslint/parser from 8.29.0 to 8.32.0

## [0.3.8] - 2025-04-01

### Added

- Initial public release
- Knowledge graph memory system with entities and relations
- Neo4j storage backend with unified graph and vector storage
- Semantic search using OpenAI embeddings
- Temporal awareness with version history for all graph elements
- Time-based confidence decay for relations
- Rich metadata support for entities and relations
- MCP tools for entity and relation management
- Support for Claude Desktop, Cursor, and other MCP-compatible clients
- Docker support for Neo4j setup
- CLI utilities for database management
- Comprehensive documentation and examples

### Changed

- Migrated storage from SQLite + Chroma to unified Neo4j backend
- Enhanced vector search capabilities with Neo4j's native vector indexing
- Improved performance for large knowledge graphs

## [0.3.0] - [Unreleased]

### Added

- Initial beta version with Neo4j support
- Vector search integration
- Basic MCP server functionality

## [0.2.0] - [Unreleased]

### Added

- SQLite and Chroma storage backends
- Core knowledge graph data structures
- Basic entity and relation management

## [0.1.0] - [Unreleased]

### Added

- Project initialization
- Basic MCP server framework
- Core interfaces and types
