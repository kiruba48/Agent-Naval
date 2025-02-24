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

[X] 3. Code Organization
    - Update imports to follow new pattern:
      * Base types from '../types'
      * Feature-specific types from '../types/feature'
      * Constants from '../constants/feature'
    - Remove unused imports (e.g., conversationService from SummaryService)
    - Use constants for status values (e.g., CONVERSATION_STATUS)

[X] 4. Session Management
    - Implement 48-hour session limit
    - Add session status tracking
    - Create archival process
    - Implement cleanup for expired sessions

[ ] 5. Integration Points
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

### Recent Changes:

1. Updated imports in services to follow new pattern:
   - SummaryService: Removed unused conversationService import
   - ConversationService: Added CONVERSATION_STATUS import
   - MessageProcessor: Organized imports between base and specific types

2. Fixed ConversationService:
   - Use CONVERSATION_STATUS constants for status values
   - Fixed duplicate conversationId declaration in createSession
   - Kept descriptive variable names for better readability

### Current Task: Implement Automatic Summary Trigger Mechanism

#### Implementation Decisions

1. **Theme Extraction**:
   - First iteration: Keep current approach of collecting themes from messages
   - Future iteration: Consider LLM-based theme extraction

2. **Summary Format**:
   ```typescript
   interface ConversationSummary {
       summary_text: string;      // Natural language summary
       themes: string[];         // Collected from messages
       action_items?: string[];  // Optional, extracted from content
       timestamp_range: string;  // e.g., "messages 6-10"
       metadata: {
           conversationId: string;
           messageCount: number;
           startTime: string;    // ISO string
           endTime: string;      // ISO string
       }
   }
   ```

3. **Error Recovery** (to be implemented last):
   - Queue-based retry system
   - Exponential backoff
   - Track failed attempts for retry

4. **Logging & Metrics**:
   - Add detailed logging for each step
   - Track timing and success rates
   - Monitor vector store operations

#### Implementation Steps

##### Phase 1: Basic Summary Generation [IN PROGRESS]
1. [ ] Update MessageProcessor:
   - [ ] Add logging to existing summary trigger logic
   - [ ] Update summary format to match new structure
   - [ ] Add proper error handling and logging

2. [ ] Update SummaryService:
   - [ ] Implement new summary format
   - [ ] Add vector store integration using VectorService
   - [ ] Add logging for each operation

3. [ ] Integration Testing:
   - [ ] Test summary generation trigger
   - [ ] Verify vector store storage
   - [ ] Check logging output

##### Phase 2: Error Handling & Recovery (Future)
1. [ ] Design queue system for failed summaries
2. [ ] Implement retry logic with exponential backoff
3. [ ] Add monitoring and alerting

#### Code Examples

1. **Updated Summary Generation**:
```typescript
interface SummaryGenerationResult {
    summary: ConversationSummary;
    vectorId: string;  // ID from vector store
    timing: {
        total: number;
        summarization: number;
        vectorization: number;
    }
}

async function generateSummary(messages: Message[]): Promise<SummaryGenerationResult> {
    const startTime = Date.now();
    
    // Generate summary text
    const summary = {
        summary_text: summarizeMessages(messages),
        themes: collectThemes(messages),
        timestamp_range: `messages ${messages[0].index}-${messages[messages.length-1].index}`,
        metadata: {
            conversationId: messages[0].conversationId,
            messageCount: messages.length,
            startTime: messages[0].timestamp.toISOString(),
            endTime: messages[messages.length-1].timestamp.toISOString()
        }
    };

    // Store in vector database
    const vector = await generateEmbedding(summary.summary_text);
    const vectorId = await vectorService.upsertVector('CONVERSATIONS', {
        vector,
        metadata: summary
    });

    return {
        summary,
        vectorId,
        timing: {
            total: Date.now() - startTime,
            summarization: summarizationTime,
            vectorization: vectorizationTime
        }
    };
}
```

#### Next Steps
1. [ ] Update MessageProcessor's triggerSummaryGeneration method
2. [ ] Add logging throughout the summary generation process
3. [ ] Implement new summary format
4. [ ] Test with real conversations

### Current Task: Fix Circular Dependency in Services

## Problem
We have a circular dependency between MessageProcessor and SummaryService where each service requires the other to be initialized first. This causes a ReferenceError when starting the app.

## Solution Plan

[X] 1. Identify the circular dependency
    - MessageProcessor imports summaryService
    - SummaryService imports messageProcessor
    - Both try to use each other during initialization

[X] 2. Implement lazy initialization
    - Update imports to import classes instead of instances
    - Add optional service properties with proper typing
    - Add initialization methods for dependency injection
    - Add getter methods with proper error handling

[X] 3. Create initialization file
    - Create initializeServices.ts
    - Initialize services in correct order
    - Export initialized instances

[ ] 4. Update service imports
    - Update agent.ts to use new imports 
    - Update ConversationService.ts to use new imports 
    - Check and update any remaining files using old imports
    - Test the initialization order

## Next Steps:

1. Update any remaining files that import these services directly
2. Add proper error handling for uninitialized services
3. Add logging for service initialization
4. Test the app startup

## Lessons Learned:
- Avoid circular dependencies by using proper dependency injection
- Use lazy initialization for services that depend on each other
- Keep service initialization in a dedicated file for better organization

### Current Task: Fix Conversation History Formatting

## Problem
The LLM is making too many tool calls because the conversation history is not properly formatted for OpenAI's chat completion API.

## Solution Plan

[X] 1. Identify the issue
   - Tool calls and responses are not properly mapped to OpenAI's format
   - This causes the LLM to not recognize completed tool calls

[ ] 2. Update conversation history mapping in agent.ts
   ```typescript
   const history = messages.map(msg => {
       // Tool call from assistant
       if (msg.role === 'assistant' && msg.toolCalls) {
           return {
               role: 'assistant',
               content: null,
               tool_calls: msg.toolCalls
           };
       }
       // Tool response
       if (msg.role === 'function') {
           return {
               role: 'function',
               content: msg.content,
               name: msg.name,
               tool_call_id: msg.toolCallId
           };
       }
       // Regular message
       return {
           role: msg.role,
           content: msg.content
       };
   });
   ```

[ ] 3. Add debug logging
   - Log the formatted history before sending to OpenAI
   - Log the LLM's interpretation of tool calls and responses

[ ] 4. Test the changes
   - Verify tool calls are properly recognized
   - Verify responses are properly associated with tool calls
   - Check if multiple tool calls are reduced

## Expected Outcome
- LLM should recognize when a tool call has been completed
- Fewer repeated tool calls for the same information
- Cleaner conversation history

### Current Task: Fix Infinite Tool Call Loop

## Problem Analysis

We're getting stuck in an infinite loop because of a mismatch between our message format and OpenAI's expected format:

1. **Current Flow**:
   ```typescript
   // In agent.ts
   const history = messages.map(msg => ({
       role: msg.role,
       content: msg.content,
       tool_calls: msg.toolCalls,      // Wrong property name
       tool_call_id: msg.toolCallId    // Wrong property name
   }))
   ```

2. **What OpenAI Expects**:
   - Assistant messages with tool calls should have:
     ```typescript
     {
       role: 'assistant',
       content: null,
       tool_calls: [{              // Note the underscore
         id: string,
         function: {
           name: string,
           arguments: string
         }
       }]
     }
     ```
   - Function messages should have:
     ```typescript
     {
       role: 'function',
       content: string,
       name: string,              // Function name
       tool_call_id: string       // Note the underscore
     }
     ```

3. **Why It's Looping**:
   - Our property names don't match OpenAI's expected format
   - When we send `toolCalls` instead of `tool_calls`, OpenAI doesn't recognize it as a tool call
   - Similarly with `toolCallId` vs `tool_call_id`
   - This causes OpenAI to keep making the same tool call because it doesn't see the previous call's response

## Proposed Solution

1. Fix the message mapping in agent.ts to use the correct property names:
   ```typescript
   const history = messages.map(msg => ({
       role: msg.role,
       content: msg.content,
       ...(msg.toolCalls && { tool_calls: msg.toolCalls }),
       ...(msg.toolCallId && { tool_call_id: msg.toolCallId }),
       ...(msg.name && { name: msg.name })
   }))
   ```

2. Add debug logging to verify the message format:
   ```typescript
   logger.debug('Mapped message for OpenAI:', JSON.stringify(history, null, 2));
   ```

Would you like me to proceed with implementing this solution?

Next up:
1. Implement session timeout logic
2. Add session cleanup process
3. Connect services for memory integration

### Conversation Memory System: Tool Call Loop Issue

#### Current Work Focus
We are implementing a hierarchical conversation memory system that:
1. Stores raw messages in Firebase
2. Generates summaries at different levels:
   - Immediate context (last 5 messages)
   - Recent summary (every 10-20 messages)
   - Global summary (entire session)
3. Uses Upstash Vector for storing and retrieving summaries
4. Handles topic changes and session management

#### Recent Changes
1. Integrated MessageProcessor with SummaryService
2. Added tool call handling in message processing
3. Implemented getMessagesForSummary to handle tool call sequences
4. Updated message storage to preserve raw OpenAI response format

#### Current Issue: Infinite Tool Call Loop
The system is stuck in an infinite loop when handling tool calls:

1. **Root Cause**:
   - When assistant makes a tool call, before getting final answer:
     ```
     User: Question
     Assistant: [Tool Call]
     Tool: [Response]
     ```
   - Summary service sees this as incomplete exchange
   - LLM tries to complete it with another tool call
   - Process repeats indefinitely

2. **Specific Problems**:
   - `getMessagesForSummary` only looks for tool response, not final answer
   - We're summarizing conversations mid-tool-call
   - Raw OpenAI format in DB means LLM sees exact same context that triggered tool call

#### Next Steps
1. [ ] Modify `getMessagesForSummary`:
   - Wait for complete exchange (User -> Assistant -> Tool -> Final Answer)
   - Or skip summarizing incomplete tool call sequences

2. [ ] Add exchange completion detection:
   ```typescript
   isCompleteExchange(messages: Message[]): boolean {
     // Check if last message completes the exchange
     // Either content or tool call -> response -> final answer
   }
   ```

3. [ ] Update summary triggers:
   - Only summarize after complete exchanges
   - Add safeguards against summarizing mid-tool-call

4. [ ] Add tool call cycle detection:
   - Track number of consecutive tool calls
   - Break cycle if threshold exceeded

#### Active Decisions and Considerations
1. **Summary Timing**:
   - When is the best time to trigger summaries?
   - How to handle long tool call chains?
   - Should we wait for explicit "completion" signals?

2. **Tool Call Handling**:
   - How many consecutive tool calls should we allow?
   - Should we modify tool response format?
   - How to handle failed tool calls in summaries?

3. **Message Format**:
   - Keep raw OpenAI format vs. transform for storage?
   - How to handle format differences between storage and LLM?
   - Balance between preserving context and preventing loops

4. **Performance Impact**:
   - Cost of additional message format checks
   - Delay in summary generation
   - Impact on conversation flow