Below is a **Product Requirements Document (PRD)** that outlines the **hierarchical conversation memory** approach using **Firebase Realtime Database** for raw message storage and **Upstash VectorDB** for summarized content. It incorporates **topic change detection**, **multiple summary levels**, and **session management**. This PRD reflects the recommended architecture and best practices discussed previously.

---

# 1. Project Overview

**Product Name**: “Mentor Agent — Hierarchical Summaries”

**Primary Goal**:  
Enable a conversation-based mentorship experience that retains **immediate context**, **topic-based summaries**, and a **global overview** by leveraging:

- **Firebase Realtime Database** for raw user/assistant messages (short- to medium-term storage).  
- **Upstash VectorDB** for hierarchical summaries and retrieval-based context.  
- **Topic change detection** using both semantic similarity and theme classification.  
- **Session management** to bound conversation length.

---

# 2. Features

1. **Topic Detection**  
   - Automate detecting when users shift from one theme to another.  
   - Leverage **theme classification** and **semantic similarity** to trigger summarization and label conversation segments.

2. **Hierarchical Summaries**  
   - **Immediate Context** (last 5 messages): stored as raw text for the LLM prompt.  
   - **Recent Summary**: Summarizes larger chunks (e.g., every 10–20 messages).  
   - **Global Summary**: Captures an overarching theme or storyline over the entire session.  
   - All summaries embedded and stored in **Upstash VectorDB**.

3. **User Session Management**  
   - **Hybrid**: Sessions can end either by explicit user action (“End Chat”) or automatically after a timeout (e.g., 24 hours of inactivity).  
   - Each conversation ID references raw logs in Firebase and summary embeddings in Upstash.

4. **Retrieval-Based Context**  
   - For new user queries, retrieve relevant summary chunks (recent + global) from Upstash VectorDB based on semantic similarity.  
   - Combine retrieved summaries with the last 5 raw messages to form the LLM prompt.

5. **Topic Change Handling**  
   - On detecting a topic shift, the system can finalize a partial summary of the segment, store it in the vector DB, and start a new segment for the new topic.

---

# 3. Requirements

## 3.1. Topic Detection

- **Functional**  
  1. **Theme Classification**: Each new user message is tagged with potential topics (e.g., “mindfulness,” “entrepreneurship”) using a classification or LLM approach.  
  2. **Semantic Similarity**: Generate an embedding for each new message and compare with the recent conversation segment (or a “topic centroid”) to gauge if it belongs to the same topic.  
  3. **Change Threshold**: If the theme classification or similarity drop below a set threshold, mark a new **topic boundary**.

- **Non-Functional**  
  - **Latency**: The classification and embedding steps should typically complete in under 500ms.  
  - **Accuracy Tuning**: Admins can adjust thresholds to reduce false positives/negatives.

## 3.2. Hierarchical Summaries

- **Functional**  
  1. **Immediate Context**: Always store and retrieve the last **5 raw messages** from Firebase for the LLM prompt.  
  2. **Recent Summaries**:  
     - Every N messages (e.g., 10–20) or upon a topic boundary, generate a summary.  
     - Store the summary text in Upstash VectorDB with appropriate metadata (`conversation_id`, `segment_index`, `themes`, etc.).  
  3. **Global Summary**:  
     - Periodically (e.g., every 3–5 segments) create a top-level summary that captures big-picture insights.  
     - Also embedded and stored in the vector DB.  
  4. **Retrieval**:  
     - For a new user query, embed the query, retrieve top K relevant summaries, and combine them with immediate context in the final LLM prompt.

- **Non-Functional**  
  - **Token Efficiency**: Summaries help reduce prompt size for very long conversations.  
  - **Scalability**: Upstash VectorDB must handle potentially thousands of summaries across many user sessions.

## 3.3. User Session Management

- **Functional**  
  1. **Session Start**: A new conversation ID is created when a user begins a session.  
  2. **Ending a Session**:  
     - **User-Initiated**: The user explicitly ends the session.  
     - **Auto-Timeout**: After X hours (e.g., 24 hours) of inactivity, mark the session as closed.  
  3. **Data Association**:  
     - Each session references raw messages in Firebase + summary entries in Upstash.  
     - Once a session is closed, no further raw messages are appended, though existing data remains accessible for future retrieval if needed.

- **Non-Functional**  
  - **Data Retention**: Possibly apply a TTL for raw Firebase messages if they are only needed for short- or medium-term. Summaries remain in Upstash for indefinite reference.  
  - **Concurrency**: Must handle multiple simultaneous user sessions without conflict.

## 3.4. Data Models

### 3.4.1. Firebase Realtime Database Structure

Example schema (JSON-like):
```json
"conversation": {
  "<conversation_id>": {
    "metadata": {
      "created_at": "timestamp",
      "user_id": "string",
      "status": "active|ended",
      "last_activity": "timestamp"
    },
    "messages": {
      "<message_id>": {
        "role": "user|assistant",
        "content": "string",
        "timestamp": "timestamp",
        "themes": ["string"],
        "embedding_id": "string (optional reference)"
      }
    }
  }
}
```

### 3.4.2. Summaries in Upstash VectorDB

Each summary is stored as an **embedded document**:
```json
{
  "id": "<unique_summary_id>",
  "embedding": [ ... ],       // the vector
  "conversation_id": "string",
  "segment_index": "int",
  "level": "recent|global",   // or "topic-level"
  "summary_content": "string",
  "themes": ["string"],
  "created_at": "datetime"
}
```

*(The exact structure depends on Upstash’s schema or indexing strategy.)*

---

# 4. Implementation Steps

## 4.1. Topic Change Detection Flow

1. **New Message In**  
   - Firebase function triggers on new write to `messages/<message_id>`.  
2. **Theme Classification**  
   - Use a quick classification approach (custom or LLM) to label the message with top themes.  
   - Store `themes` in the message record.  
3. **Embedding & Similarity**  
   - Generate an embedding for the new message (OpenAI embeddings or alternative).  
   - Compare with a running “topic centroid” or last few message embeddings.  
4. **Decide if Topic Changed**  
   - If mismatch is above threshold (or themes differ significantly), raise a “topicChange” event.  
   - Potentially finalize a summary for the old topic segment.

## 4.2. Summaries (Recent & Global)

1. **Immediate Context** (client usage)  
   - Frontend or backend fetches the last 5 messages from Firebase for the LLM prompt.  
2. **Recent Summary**  
   - On hitting N messages or a “topicChange” event:  
     - Aggregate those messages, prompt the LLM for a summary.  
     - Embed the summary, store it in Upstash with metadata.  
3. **Global Summary**  
   - After every few segments or at session end, generate a **global** summary that captures the entire conversation’s main themes.  
   - Store in Upstash similarly to the recent summary.

## 4.3. Retrieval Augmentation

1. **New User Query**  
   - Embed the user query.  
   - Query Upstash VectorDB for **top K** relevant summaries (could be “recent” or “global” level).  
2. **Construct the Prompt**  
   - Combine the immediate context (last 5 messages from Firebase) with retrieved summary content.  
3. **LLM Response**  
   - The LLM references summarized knowledge plus immediate conversation details.  
   - Store the new message in Firebase.

## 4.4. Session Management

1. **Session Creation**  
   - When a user starts a conversation, create a record in `conversation/<conversation_id>/metadata`.  
2. **User End**  
   - If the user explicitly ends the session, set `metadata.status = "ended"`.  
   - Optionally finalize any pending summaries.  
3. **Auto-Timeout**  
   - A scheduled function checks for `last_activity` timestamps older than X hours. Sets those sessions to `status = "ended"`.  
   - Summaries remain in Upstash for future reference if needed.

---

# 5. Non-Functional Considerations

1. **Performance & Latency**  
   - Firebase writes must be near real-time. Summaries should be generated asynchronously (e.g., using Cloud Functions) to avoid blocking the user experience.  
   - Upstash VectorDB queries typically respond quickly, but be mindful of embedding calls for every new message.  
2. **Scalability**  
   - Firebase Realtime Database can scale for high concurrency, especially if you shard data by `conversation_id`.  
   - Upstash can handle vector similarity at scale; ensure indexing is optimized.  
3. **Security & Privacy**  
   - Use Firebase rules to ensure only authorized users can read/write their conversations.  
   - If storing embeddings or raw messages, consider encryption at rest and in transit.  
4. **Cost**  
   - Firebase pricing is based on read/write operations.  
   - Upstash typically charges for storage and similarity queries.  
   - Summarization calls to the LLM or theme classification approaches can also add cost.

---

# 6. Example API & Interactions

Although much is event-driven via Firebase triggers, you may still expose REST endpoints for direct client interactions:

1. **`POST /api/start_session`**  
   - Creates a new conversation record in Firebase (metadata: status=“active”, user_id, timestamps).

2. **`POST /api/send_message`**  
   - Writes user message to Firebase: `conversation/<id>/messages/<msg_id>`.  
   - Triggers a Cloud Function to do theme classification, embedding, topic detection.

3. **`GET /api/get_recent_messages?conversation_id=xxx`**  
   - Returns the last 5 messages from Firebase for immediate context.

4. **`POST /api/end_session`**  
   - Sets conversation status to “ended” in Firebase.  
   - Optionally triggers a final global summary.

*(You can also rely fully on Firebase real-time listeners if you don’t need dedicated REST endpoints.)*

---

## Conclusion

This PRD details a **hierarchical conversation memory system** with:

1. **Topic Detection** (semantic + theme-based).  
2. **Immediate Context** from Firebase.  
3. **Summaries** stored in Upstash VectorDB at multiple granularities (recent, global).  
4. **Session Management** that balances user-driven and auto-timeout closure.

By following these guidelines and data flows, your “Mentor Agent — Hierarchical Summaries” application will efficiently capture, summarize, and retrieve conversation context for a **scalable**, **context-rich** user experience.

---

# 7. Incremental Implementation Plan for Hierarchical Summary Retrieval

This section outlines a phased approach to implementing the hierarchical summary retrieval system, starting with basic functionality and gradually adding more sophisticated features.

## Phase 1: Basic Query-Based Retrieval (Week 1)

### Components
- Basic vector search against Upstash
- Simple integration with conversation flow
- Initial retrieval testing

### Key Implementation
```typescript
class ContextRetrievalService {
  async getQueryBasedSummaries(
    query: string, 
    conversationId: string, 
    options = { topK: 3 }
  ): Promise<Summary[]> {
    const queryEmbedding = await this.embeddingService.createEmbedding(query);
    return await this.vectorService.querySimilar('summaries', queryEmbedding, {
      topK: options.topK,
      filter: { conversationId }
    });
  }
}
```

## Phase 2: Enhanced Retrieval (Week 2)

### Components
- Recency boosting
- Immediate context integration
- Global summary implementation

### Key Implementation
```typescript
class ContextRetrievalService {
  async getRelevanceRecencySummaries(
    query: string,
    conversationId: string,
    options = { topK: 3, recencyWeight: 0.3 }
  ): Promise<Summary[]> {
    const similarSummaries = await this.getQueryBasedSummaries(query, conversationId);
    return this.rankByRelevanceAndRecency(similarSummaries, options);
  }

  async getImmediateContext(conversationId: string): Promise<Summary> {
    const recentMessages = await this.messageService.getLastMessages(conversationId, 5);
    return this.formatImmediateContext(recentMessages);
  }
}
```

## Phase 3: Topic-Based Retrieval (Week 3)

### Components
- Topic detection implementation
- Topic-based summary retrieval
- Integration with combined context

### Key Implementation
```typescript
class ContextRetrievalService {
  async detectTopics(message: string): Promise<string[]> {
    return await this.llmService.classifyTopics(message);
  }

  async getTopicBasedSummaries(
    topics: string[],
    conversationId: string,
    options = { topK: 2, threshold: 0.7 }
  ): Promise<Summary[]> {
    const topicEmbeddings = await Promise.all(
      topics.map(topic => this.embeddingService.createEmbedding(topic))
    );
    return await this.retrieveTopicSummaries(topicEmbeddings, options);
  }
}
```

## Phase 4: Optimization & Context Window Management (Week 4)

### Components
- Token estimation
- Context prioritization
- Window usage optimization

### Key Implementation
```typescript
class ContextRetrievalService {
  async getOptimizedContext(
    query: string,
    conversationId: string,
    options = {
      maxTokens: 2000,
      priorityWeights: {
        immediate: 1.0,
        query: 0.8,
        topic: 0.6,
        global: 0.4
      }
    }
  ): Promise<Summary[]> {
    const allContext = await this.getFullContext(query, conversationId);
    return this.optimizeForContextWindow(allContext, options);
  }
}
```

## Implementation Metrics

1. **Performance Metrics**
   - Latency per retrieval operation
   - Context window utilization
   - Summary relevance scores

2. **Quality Metrics**
   - Response coherence
   - Context retention accuracy
   - Topic classification precision

3. **System Metrics**
   - Memory usage
   - API call frequency
   - Cache hit rates

## Testing Strategy

1. **Unit Tests**
   - Individual component functionality
   - Edge case handling
   - Error recovery

2. **Integration Tests**
   - Cross-component interactions
   - End-to-end flows
   - Performance benchmarks

3. **Quality Assurance**
   - Manual conversation testing
   - Context retention verification
   - Response quality assessment

## Rollout Strategy

1. **Development Environment**
   - Implement basic retrieval
   - Test with synthetic conversations
   - Measure baseline metrics

2. **Staging Environment**
   - Add enhanced features
   - Test with real conversation data
   - Validate performance metrics

3. **Production Environment**
   - Gradual feature rollout
   - Monitor system metrics
   - Gather user feedback

## Success Criteria

1. **Performance**
   - Retrieval latency < 500ms
   - Context window utilization > 80%
   - Cache hit rate > 60%

2. **Quality**
   - Topic classification accuracy > 85%
   - Response coherence improvement > 30%
   - Context retention score > 90%

3. **System**
   - Error rate < 1%
   - API usage within limits
   - Memory usage within bounds

This incremental approach ensures a stable, well-tested implementation while allowing for continuous improvement and optimization at each phase.