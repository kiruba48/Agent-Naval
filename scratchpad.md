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

# Scratchpad

# Current Task: Implement User Authentication and Progressive Theme System

## Progress (2025-02-09)

[X] 1. Firebase Setup and Configuration
    - Installed Firebase SDK
    - Set up Firebase configuration
    - Added environment variables

[X] 2. User Authentication Implementation
    - Created FirebaseService class
    - Implemented user authentication (sign in/sign out)
    - Added user profile management
    - Added basic error handling

[X] 3. Theme Management System
    - Created theme data structure
    - Implemented theme initialization script
    - Added theme preference management
    - Added user preference commands

## In Progress

[ ] 4. Progressive Theme System
    - Theme Detection System
      * Implement keyword matching
      * Add confidence scoring
      * Create theme suggestion logic
    - User Interaction Flow
      * Add contextual theme suggestions
      * Implement preference updates
      * Add suggestion history tracking
    - Theme Detection Service
      * Create theme detector service
      * Implement natural language processing
      * Add confidence scoring system

[ ] 5. Conversation Memory Implementation
    - Implement ephemeral storage for conversations
    - Add conversation summarization
    - Create cleanup mechanism for old files
    - Add conversation backup system

## Next Steps

1. Implement Theme Detection System
   - Create theme detector service
   - Add keyword matching system
   - Implement confidence scoring

2. Update Query Processing
   - Add theme detection to query pipeline
   - Implement suggestion logic
   - Add user interaction flow

3. Enhance User Experience
   - Add suggestion history tracking
   - Implement opt-out mechanism
   - Add preference analytics

4. Testing and Documentation
   - Add unit tests for theme detection
   - Document theme detection system
   - Create user guide for preferences

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