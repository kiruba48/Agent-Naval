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

# Scratchpad

# Current Task: Implement Hierarchical Conversation Memory System

## Implementation Plan (2025-02-11)

### Phase 1: Basic Setup [IN PROGRESS]

[X] 1. Vector Store Setup
    - Created VectorService class
    - Implemented basic index management
    - Added error handling
    - Removed temporary implementations (to be added back later):
      * Retry logic with exponential backoff
      * Index validation with test vectors
      * getIndex helper method

[X] 2. Vector Operations
    - Implement upsert for storing vectors
    - Add query operations for similarity search
    - Add batch operations for efficiency
    - Re-implement retry logic with exponential backoff
    - Add proper index validation

[ ] 3. Session Management
    - Implement 48-hour session limit
    - Add session status tracking
    - Create archival process
    - Implement cleanup for expired sessions

[ ] 4. Integration Points
    - Connect with ConversationService
    - Link with SummaryService
    - Integrate with existing knowledge base

### Configuration Decisions:

1. **Session Management:**
   - Store metadata in Firebase
   - 48-hour session limit
   - User-initiated end + auto-timeout

2. **Vector Operations:**
   - Batch embedding for initial implementation
   - Embed only summaries (5 messages per summary)
   - Similarity threshold: 0.75-0.8
   - Return top 3-5 results

3. **Error Handling:**
   - Short retry (2-3 attempts)
   - Exponential backoff
   - Log failures for monitoring

### Next Steps:

1. Implement session management:
   - Create session tracking
   - Implement timeout logic
   - Add cleanup process

2. Create integration points:
   - Connect with existing services
   - Add event handlers
   - Implement error recovery

3. Focus on phase 2 and 3 tasks:
   - Implement memory enhancement
   - Add topic analysis
   - Implement performance optimization

### Notes:

- Using OpenAI's text-embedding-3-small model (1024 dimensions)
- Separate indices for knowledge base and conversations
- Focus on minimal setup first, then scale
- Monitor token usage and adjust as needed

### Lessons Learned:
- Upstash Vector Index constructor requires url and token parameters
- reset() method is for clearing index, not creating one
- Keep implementation simple initially, add complexity when needed
- Validate actual requirements before implementing features

# Conversation Memory Implementation - Phase 1

## Implementation Plan

### 1. Basic Workflow
[X] Vector Service Implementation
[ ] First Iteration: Basic Conversation Flow with Summaries

### Current Task: First Iteration Implementation

#### Components and Flow:

1. **Message Processing** [IN PROGRESS]
   [X] Create MessageProcessor service
   [X] Implement message pair processing
   [X] Add error handling and types
   [X] Implement background summary generation
   [ ] Add tests for MessageProcessor
   [ ] Add logging and monitoring
   [ ] Add retry strategies for failed operations

2. **Summary Generation**
   [ ] Create SummaryGenerator service
   [ ] Implement chunk-based summary generation
   [ ] Add metadata and theme extraction
   [ ] Store summaries in Firebase and Upstash
   [ ] Add tests for summary generation

   Implementation details:
   - Generate summaries for strictly sequential chunks (1-10, 11-20, etc.)
   - Include message content and essential metadata
   - Store summaries in both Firebase and Upstash
   - Only embed summaries (not individual messages)

3. **Context Retrieval**
   [ ] Create ContextAssembler service
   [ ] Implement relevant summary retrieval
   [ ] Add recent message handling
   [ ] Format context for LLM prompt
   [ ] Add tests for context assembly

   Implementation details:
   - Retrieve top 3-5 relevant summaries
   - Combine with last 3-5 message pairs
   - Format context for LLM prompt

#### Progress (2025-02-11):

1. Completed MessageProcessor implementation:
   - Added types for messages and operations
   - Implemented message pair processing
   - Added error handling with retries
   - Made summary generation asynchronous
   - Added proper error types and operation tracking
   - Improved type safety with enums

2. Next steps:
   - Add tests for MessageProcessor
   - Implement SummaryGenerator service
   - Add logging and monitoring
   - Implement retry strategies

3. Lessons learned:
   - Keep types and operations separate
   - Use enums for better type safety
   - Make summary generation non-blocking
   - Handle errors at appropriate levels

#### Implementation Details:

1. **Message Flow**
```typescript
interface MessageProcessor {
    // Track message pairs and trigger summary
    async processMessagePair(
        conversationId: string,
        userMessage: string,
        assistantMessage: string
    ): Promise<void>;

    // Check if summary needed (every 10 messages)
    private shouldGenerateSummary(messageCount: number): boolean;
}
```

2. **Summary Generation**
```typescript
interface SummaryGenerator {
    // Generate summary from message chunk
    async generateChunkSummary(
        messages: Message[], 
        metadata: ConversationMetadata
    ): Promise<Summary>;

    // Store summary in both Firebase and Upstash
    private async storeSummary(
        summary: Summary, 
        embedding: number[]
    ): Promise<void>;
}
```

3. **Context Assembly**
```typescript
interface ContextAssembler {
    // Get context for new message
    async assembleContext(
        conversationId: string,
        query: string
    ): Promise<string>;

    // Format prompt with summaries and recent messages
    private formatPrompt(
        summaries: Summary[],
        recentMessages: Message[],
        query: string
    ): string;
}
```

#### LLM Integration:
Using existing `generateText` and `generateEmbeddings` functions from `llm.ts`:
- `generateText`: For generating summaries and responses
- `generateEmbeddings`: For embedding summaries in Upstash

#### Prompt Template:
```typescript
const PROMPT_TEMPLATE = `
SYSTEM:
"You are Mentor Agent, an AI trained to provide insightful guidance on mindfulness, entrepreneurship, and personal development.
Always be concise, accurate, and maintain a friendly tone."

CONTEXT (FROM RETRIEVED SUMMARIES):
{summaries}

RECENT DIALOGUE:
{recentMessages}

NEW USER QUERY:
{query}
`;
```

### Next Steps:
[ ] 1. Implement MessageProcessor
    - Add message pair tracking
    - Add summary trigger logic

[ ] 2. Implement SummaryGenerator
    - Add summary generation with LLM
    - Add Firebase and Upstash storage

[ ] 3. Implement ContextAssembler
    - Add context retrieval logic
    - Add prompt formatting

[ ] 4. Testing
    - Test basic conversation flow
    - Test summary generation
    - Test context retrieval
    - Test end-to-end workflow

### Questions to Address:
1. How to handle failed summary generation?
2. How to handle concurrent message processing?
3. Should we implement retry logic for failed operations?
4. How to handle context window size limits?

### Technical Prerequisites:
1. Firebase configuration 
2. Upstash Vector setup 
3. LLM integration 
4. OpenAI embeddings integration 

# Vector Service Implementation Progress

## Completed Tasks
[X] Fix type errors in VectorService implementation
[X] Update VectorMetadata interface and move to types file
[X] Optimize batch operations
[X] Add detailed logging and progress tracking
  - Added BatchOperationStats interface
  - Added real-time progress updates
  - Added success rate calculations
  - Added comprehensive operation summaries

## Current Implementation
- Using OpenAI's text-embedding-3-small model (1024 dimensions)
- Batch operations with configurable chunk size (default: 20)
- Concurrent processing with limits (default: 3 concurrent batches)
- Detailed logging and progress tracking for all operations

## Next Steps
[ ] Add retry strategy configuration
  - Configurable backoff delays
  - Operation-specific retry attempts
  - Custom retry conditions

[ ] Improve error handling
  - Add error categorization
  - Add error recovery strategies
  - Add detailed error context

[ ] Add performance optimizations
  - Add caching for frequently accessed vectors
  - Add connection pooling
  - Add request batching for similar operations

[ ] Add monitoring and metrics
  - Add operation latency tracking
  - Add success/failure rate metrics
  - Add resource usage monitoring

[ ] Add data validation and sanitization
  - Add input validation for vectors
  - Add metadata validation
  - Add data type conversions

[ ] Add cleanup and maintenance
  - Add index cleanup utilities
  - Add vector pruning strategies
  - Add index optimization routines

## Lessons Learned
1. Always validate vector dimensions before operations
2. Use string IDs for Upstash operations (convert from number if needed)
3. Batch deletes can be done in a single operation, no need for chunking
4. Include detailed logging for debugging and monitoring
5. Track operation progress for long-running batch operations

## Questions to Consider
1. Should we add automatic retries for specific error types?
2. Should we add automatic cleanup of old vectors?
3. Should we add vector validation before every operation?
4. Should we add more sophisticated progress tracking?
5. Should we add more detailed performance metrics?

# Today's Lessons (2025-02-06)

## TypeScript Type System
- When extending interfaces in TypeScript, optional properties (`property?: type`) in the base interface are not compatible with required properties (`property: type`) in the extended interface
- When transforming arrays of objects with optional properties to arrays with required properties, use explicit mapping with the nullish coalescing operator (`??`) to provide default values
- TypeScript's type system helps catch potential runtime errors by enforcing proper property presence, especially important in data processing pipelines

## Q&A Pipeline Development
- Maintain a clear separation between base data types (like QAPair) and their processed versions (like FinalQAPair) to ensure data validation at compile time
- Use explicit type transformations when moving data through pipeline stages to ensure data integrity
- Document pipeline stages and data transformations in both code comments and project documentation (INSTRUCTIONS.md) for better maintainability
- Keep track of completed and remaining tasks in a structured format to maintain project momentum and clarity