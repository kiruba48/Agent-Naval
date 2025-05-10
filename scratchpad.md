# Lessons

- For website image paths, always use the correct relative path (e.g., 'images/filename.png') and ensure the images directory exists
- For search results, ensure proper handling of different character encodings (UTF-8) for international queries
- Add debug information to stderr while keeping the main output clean in stdout for better pipeline integration
- When using seaborn styles in matplotlib, use 'seaborn-v0_8' instead of 'seaborn' as the style name due to recent seaborn version changes
- When using Jest, a test suite can fail even if all individual tests pass, typically due to issues in suite-level setup code or lifecycle hooks
- Keep imports clean by removing unused ones, they can creep in when copying boilerplate code
- When using ChromaDB collections, always provide an embeddingFunction that matches the embedding model used in queries (e.g., OpenAI's text-embedding-3-small)
- When using ChromaDB with TypeScript, the embedding function should be provided as a direct async function rather than an object with a __call__ method
- When using ChromaDB's embedding function, it must be provided as an object with a `generate` method that implements the `IEmbeddingFunction` interface, not as a standalone function
- When using Upstash Vector's query method, pass the collection/namespace as a separate parameter to the query method rather than including it in the query options object
- When using Upstash Vector's query method, pass collection names as a namespace object ({ namespace: collectionName }) rather than directly as a string
- When working with Upstash Vector search results, the content field is nested inside the metadata object (access via result.metadata.content)
- When querying Upstash Vector, set includeMetadata: true to get metadata fields in query results
- When implementing Firebase authentication, ensure @types/readline-sync is installed for TypeScript compatibility
- Keep constants separate from type definitions in TypeScript projects:
  * Types should be in a types/ directory (e.g., src/memory/types/vector.ts)
  * Constants should be in a constants/ directory (e.g., src/memory/constants/vector.ts)
  * This improves code organization and makes it easier to maintain and update values
- When using Upstash Vector's Index.query method:
  * Pass a single options object containing all parameters
  * Required fields: { vector: number[], topK: number }
  * Optional fields: includeMetadata, filter, namespace
  * Don't pass vector and options separately like query(vector, options)
- When implementing tools:
  * Use the root types.ts for ToolFn interface
  * Keep tool definition and implementation separate
  * Match response schema exactly with the underlying service (e.g., vectorStore)
  * Use z.infer for type inference from Zod schemas
- Keep imports organized by source:
  * Base types from '../types'
  * Feature-specific types from '../types/feature'
  * Constants from '../constants/feature'
  * This improves code organization and makes dependencies clearer
- When working with OpenAI's chat API, save both tool calls and their responses to maintain complete conversation history
- In TypeScript, when using OpenAI's chat API, message roles can only be 'user', 'assistant', or 'function' - not 'tool'
- When using OpenAI's tool calling API, use role: 'tool' for tool responses and ensure tool_calls property uses snake_case (tool_calls, tool_call_id) not camelCase
- When using OpenAI's chat API, message roles should be 'user', 'assistant', or 'function', and for tool responses, use role: 'tool' and ensure the tool_calls property uses snake_case.
- Always maintain proper context between tool calls and their responses to prevent OpenAI API errors
- Implement hard limits on tool calls (MAX_TOOL_CALLS = 3) and timeouts (30 seconds) to prevent infinite loops
- Use Firebase's natural chronological ordering instead of manual sorting for better performance
- Implement proper timestamp validation with year range checks (2000-2100) to prevent false positives

# Scratchpad

# Current Task: Implement Memory System, Topic Management, and Summary System

## Status Update (2025-02-27)

### Recently Resolved Issues

[X] 1. Tool Call Loop Issues
    - Implemented MAX_TOOL_CALLS limit (3)
    - Added 30-second timeout
    - Fixed message format for OpenAI's API
    - Ensured proper tool_calls and tool_call_id property names
    - Improved error handling for failed tool calls
    - Enhanced loop prevention mechanisms

[X] 2. Circular Dependencies
    - Resolved circular dependency between MessageProcessor and SummaryService
    - Implemented lazy initialization
    - Added proper dependency injection
    - Created initialization file for service ordering
    - Updated service imports throughout the application

[X] 3. Conversation History Formatting
    - Fixed property naming (tool_calls vs toolCalls)
    - Ensured proper context between tool calls and responses
    - Implemented dual-format message display
    - Enhanced message retrieval logic
    - Maintained chronological ordering

### Current Implementation Plan

#### 1. Memory System [IN PROGRESS]

[ ] Topic Change Detection
    - Design algorithm to detect significant topic shifts
    - Implement confidence scoring for topic changes
    - Add triggers for summary generation on topic change
    - Test with various conversation patterns

[ ] Hierarchical Summaries
    - Implement immediate context (5 messages)
    - Add recent summary generation (10-20 messages)
    - Create global session summary
    - Ensure proper linking between summary levels

[ ] Summary Retrieval System
    - Design query interface for summaries
    - Implement relevance-based retrieval
    - Add filtering and sorting options
    - Test with various query patterns

[ ] Memory Pruning and Cleanup
    - Design pruning strategy for old summaries
    - Implement cleanup for expired sessions
    - Add archival process for important data
    - Test with various session patterns

#### 2. Topic Management

[ ] Theme Classification
    - Design classification algorithm
    - Implement confidence scoring
    - Add support for multiple themes
    - Test with various conversation topics

[ ] Topic Segmentation
    - Design segmentation algorithm
    - Implement boundary detection
    - Add support for nested topics
    - Test with various conversation patterns

[ ] Topic Change Triggers
    - Design trigger system for topic changes
    - Implement notification mechanism
    - Add support for manual triggers
    - Test with various trigger scenarios

[ ] Topic-based Context Retrieval
    - Design retrieval interface for topics
    - Implement relevance-based filtering
    - Add support for cross-topic queries
    - Test with various retrieval patterns

#### 3. Summary System

[ ] Immediate Context (5 messages)
    - Design format for immediate context
    - Implement generation algorithm
    - Add support for tool call sequences
    - Test with various conversation patterns

[ ] Recent Summary (10-20 messages)
    - Design format for recent summary
    - Implement generation algorithm
    - Add support for topic changes
    - Test with various conversation patterns

[ ] Global Session Summary
    - Design format for global summary
    - Implement generation algorithm
    - Add support for multiple topics
    - Test with various session patterns

[ ] Summary Embeddings Storage
    - Design storage format for embeddings
    - Implement batch processing
    - Add support for incremental updates
    - Test with various embedding models

[ ] Relevance-based Retrieval
    - Design retrieval interface
    - Implement similarity search
    - Add support for filtering and sorting
    - Test with various query patterns

### Next Steps

1. Start with Topic Change Detection:
   - Research algorithms for detecting topic shifts
   - Design confidence scoring system
   - Implement prototype for testing
   - Evaluate with sample conversations

2. Then move to Hierarchical Summaries:
   - Design summary formats for each level
   - Implement generation algorithms
   - Test with various conversation patterns
   - Evaluate summary quality

3. Finally, implement Summary Retrieval:
   - Design query interface
   - Implement similarity search
   - Test with various query patterns
   - Evaluate retrieval quality

### Decision Points

1. **Topic Detection Approach**:
   - Rule-based vs. ML-based
   - Threshold for topic change
   - Handling of subtopics

2. **Summary Generation**:
   - Extractive vs. abstractive
   - Length and detail level
   - Handling of tool calls

3. **Retrieval Strategy**:
   - Vector similarity vs. keyword
   - Ranking algorithm
   - Filtering options