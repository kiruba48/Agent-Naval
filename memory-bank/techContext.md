# Technical Context

## Technologies Used

1. **Runtime & Language**:

   - TypeScript/Node.js with ESM modules
   - tsx for TypeScript execution
   - Zod for runtime type validation

2. **AI & ML**:

   - OpenAI API (v4.81.0)
   - Anthropic AI SDK
   - Upstash Vector for embeddings storage

3. **Storage & Database**:

   - Firebase Realtime Database
   - Firebase Admin SDK
   - LowDB for local storage

4. **Document Processing**:

   - PDF.js for PDF parsing
   - EPUB parser
   - fs-extra for enhanced file operations

5. **UI/UX**:
   - readline-sync for CLI interaction
   - ora for loading spinners
   - terminal-image for image display

## Development Setup

```bash
# Install dependencies
pnpm install

# Start the application
pnpm start

# Run Firebase connection test
pnpm test:firebase

# Initialize themes
pnpm init:themes
```

## Technical Constraints

1. **Runtime**:

   - ESM modules only (type: "module")
   - TypeScript ^5.0.0 required
   - Node.js environment

2. **API Dependencies**:

   - Requires OpenAI API key
   - Requires Firebase project setup
   - Requires Upstash Vector account

3. **Storage**:

   - Firebase Realtime DB for conversation storage
   - Upstash Vector for embeddings
   - Local filesystem for temporary storage

4. **Processing**:
   - PDF and EPUB document support
   - Image processing capabilities
   - CLI-based interface

## Technical Decisions

### Message Storage & Retrieval

1. **Firebase Message Ordering**:

   ```typescript
   // Leveraging Firebase's natural chronological ordering
   interface MessageStore {
     [messageId: string]: {
       content: string;
       timestamp: string;
       role: 'user' | 'assistant' | 'tool';
       tool_calls?: Array<{
         id: string;
         type: 'function';
         function: {
           name: string;
           arguments: string;
         };
       }>;
       tool_call_id?: string;
     };
   }
   ```

   **Key Benefits**:

   - Push IDs are chronologically sortable by default
   - Natural ordering matches conversation flow
   - Efficient retrieval without manual sorting
   - Maintains tool call context

2. **Message Retrieval Strategy**:

   ```typescript
   // Enhanced retrieval with tool response context
   async getLastMessages(conversationId: string, count: number): Promise<Message[]> {
     const messages = await this.getData<Record<string, CreateMessage>>(
       this.getConversationPath(conversationId, FIREBASE_PATHS.messages)
     );

     if (!messages) return [];

     const messageEntries = Object.entries(messages);
     const lastMessages = messageEntries.slice(-count);

     // If first message is a tool response, include the previous message
     if (lastMessages[0]?.[1].role === 'tool') {
       const previousMessage = messageEntries[messageEntries.length - count - 1];
       if (previousMessage) {
         return [
           { ...previousMessage[1], id: previousMessage[0] },
           ...lastMessages.map(([id, msg]) => ({ ...msg, id })),
         ];
       }
     }

     return lastMessages.map(([id, msg]) => ({ ...msg, id }));
   }
   ```

   **Advantages**:

   - Minimal processing overhead
   - Preserves conversation order
   - Efficient memory usage
   - Maintains tool call context
   - Prevents OpenAI API errors

3. **Message Display Strategy**:

   ```typescript
   // Dual-format message display
   export const logMessage = (message: AIMessage) => {
     // Technical logging for debugging
     if (role === 'assistant') {
       console.log(`\n${color}[ASSISTANT]${reset}`);
       console.log(`${message.content}\n`);
     }

     // User-friendly output returned separately
     return message.content; // Displayed with "💡 AI Response:"
   };
   ```

   **Benefits**:

   - Clear technical logging for debugging
   - Enhanced user experience
   - Distinct message type handling
   - Preserved debugging capability

### Tool Call Management

1. **Safety Mechanisms**:

   ```typescript
   const MAX_TOOL_CALLS = 3;
   const TIMEOUT_MS = 30000; // 30 seconds

   interface ToolCallState {
     count: number;
     startTime: number;
     lastCallId: string;
   }
   ```

2. **System Prompt Design**:

   ```typescript
   const systemPrompt = `
     // Tool usage rules:
     1. Make only ONE tool call per response
     2. Work with available information
     3. Never chain tool calls
     4. Acknowledge limitations
   `;
   ```

3. **Error Handling**:
   ```typescript
   try {
     if (toolCallCount > MAX_TOOL_CALLS) {
       throw new ToolCallError('Maximum calls exceeded');
     }
     if (Date.now() - startTime > TIMEOUT_MS) {
       throw new TimeoutError('Tool call timeout');
     }
   } catch (error) {
     // Graceful degradation
     return formatErrorResponse(error);
   }
   ```

## Performance Considerations

1. **Message Processing**:

   - Avoid unnecessary sorting operations
   - Use Firebase's built-in ordering
   - Minimize data transformations
   - Preserve tool call context
   - Efficient message window management

2. **Tool Call Efficiency**:

   - Hard limits on consecutive calls
   - Timeout boundaries
   - Clear completion criteria
   - Context preservation between calls

3. **Memory Usage**:
   - Efficient message slicing
   - Minimal state tracking
   - Smart context windowing
   - Optimized tool response handling

## Error Handling Strategy

1. **Tool Call Errors**:

   - Maximum call limit exceeded
   - Timeout reached
   - Invalid tool responses
   - Missing tool call context

2. **Message Processing Errors**:

   - Invalid message format
   - Missing required fields
   - Ordering issues
   - Tool response context issues

3. **Recovery Mechanisms**:
   - Graceful degradation
   - Clear user feedback
   - State recovery options
   - Context preservation fallbacks

This technical context reflects our current understanding and implementation decisions, particularly around message ordering, tool call handling, and display strategies. These decisions are crucial for maintaining system stability and performance while ensuring both technical visibility and user-friendly output.
