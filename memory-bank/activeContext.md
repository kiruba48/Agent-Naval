# Active Context – Conversation Memory Implementation

This section outlines our current work focus and the active decisions and considerations driving our implementation of the hierarchical conversation memory system.

---

## Current Work Focus

- **Hierarchical Conversation Memory**  
  Implementing a multi-level memory system that combines raw message storage with summarized content:

  - **Immediate Context**: Maintain the last 5 raw messages in Firebase for real-time LLM prompts.
  - **Recent & Global Summaries**: Generate and store summaries in Upstash VectorDB to capture conversation segments and the overall session.

- **Topic Change Detection**  
  Detect shifts in conversation themes using a combination of:

  - **Semantic Similarity**: Compare new message embeddings with recent context.
  - **Theme Classification**: Label messages with potential topics (e.g., mindfulness, entrepreneurship) to determine when a topic boundary occurs.

- **Session Management**  
  Managing conversation sessions through:
  - **User-Initiated or Automatic Endings**: Sessions can be closed by user action or automatically after inactivity (e.g., 24 hours).
  - **Data Association**: Each session links raw messages in Firebase with summary embeddings in Upstash for efficient retrieval.

---

## Active Decisions & Considerations

- **Data Storage & Retrieval Strategy**

  - **Firebase Realtime Database**: Chosen for near real-time raw message storage and quick access to the most recent conversation turns.
  - **Upstash VectorDB**: Utilized for storing summarized content and enabling fast, retrieval-based context augmentation.

- **Summarization Process**

  - **Asynchronous Processing**: Summaries (both recent and global) are generated asynchronously via Cloud Functions to avoid interrupting the user experience.
  - **Granularity Levels**: The system differentiates between immediate raw context, recent summaries (generated every 10–20 messages or upon a topic change), and overarching global summaries for overall session insights.

- **Topic Change Detection**

  - **Threshold-Based Triggering**: A new topic is flagged when the semantic similarity between the current message and the previous context falls below a set threshold, or when theme classification indicates a shift.
  - **Event-Driven Updates**: Topic change events trigger the finalization and storage of summaries for the outgoing segment, initiating a new segment for the conversation.

- **Performance & Scalability**

  - **Latency Goals**: Aim to complete theme classification and embedding steps within 500ms to maintain a responsive system.
  - **Token Efficiency**: Hierarchical summaries reduce prompt size and ensure that the LLM operates within optimal token limits.
  - **Scalability**: The design anticipates high concurrency by efficiently sharding Firebase data by `conversation_id` and leveraging Upstash for rapid vector similarity searches.

- **Security & Cost Considerations**
  - **Security Measures**: Enforce strict Firebase rules to ensure only authorized users can access and modify conversation data, along with encrypted transmission for sensitive data.
  - **Cost Management**: Monitor Firebase read/write operations and Upstash query costs, as well as the expense associated with frequent summarization and embedding calls.

---

This active context section captures our current priorities and the strategic decisions behind our hierarchical conversation memory system. It ensures that as we move forward, every team member is aligned on our objectives, technology choices, and performance targets.

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
