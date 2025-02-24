### Technical Overview

#### Technologies Used

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

#### Development Setup

```bash
# Install dependencies
pnpm install

# Start the application
pnpm start

# Run Firebase connection test
pnpm test:firebase

# Initialize themes
pnpm init:themes

Technical Constraints
Runtime:
ESM modules only (type: "module")
TypeScript ^5.0.0 required
Node.js environment
API Dependencies:
Requires OpenAI API key
Requires Firebase project setup
Requires Upstash Vector account
Storage:
Firebase Realtime DB for conversation storage
Upstash Vector for embeddings
Local filesystem for temporary storage
Processing:
PDF and EPUB document support
Image processing capabilities
CLI-based interface

This technical overview helps us understand:

We're working in a TypeScript/Node.js environment with strong type safety (Zod)
We have multiple AI providers (OpenAI, Anthropic) to consider
The system is built for real-time interaction with Firebase
We have vector storage capabilities with Upstash
The architecture supports complex document processing
This context is important for our tool call loop issue because:

We can use Zod for runtime validation of message formats
We have real-time DB capabilities to track conversation state
We can store metadata about tool call sequences
TypeScript gives us strong typing for message formats
```
