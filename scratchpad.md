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

# Scratchpad

# Current Task: Fix JSON Parsing Error in Theme Classification

## Problem
The theme classifier is failing to parse JSON responses from the LLM API, causing the pipeline to fail.

## Progress
[X] 1. Identified the issue
    - JSON parsing error in themeClassifier.ts
    - Problem with malformed JSON response from LLM
    
[X] 2. Implemented fixes
    - Updated prompt format to be more explicit about JSON structure
    - Added better JSON cleaning and validation
    - Improved error handling and logging
    - Fixed Python path to use virtual environment correctly

[X] 3. Tested the solution
    - Created test-theme.ts for testing
    - Successfully classified sample text
    - Verified proper JSON formatting and theme identification
    - Confirmed confidence scores are within expected range

[X] 4. Optimized environment loading
    - Modified load_environment() to stop after finding required variables
    - Added module-level flag to prevent repeated loading
    - Moved environment loading to happen only when needed
    - Fixed issue with duplicate environment loading messages

## Next Steps
[X] 1. Test the theme classification with sample text
[X] 2. Monitor error output for any remaining issues
[ ] 3. Consider adding retry logic for failed classifications

## Lessons Learned
- Always provide explicit JSON format examples in prompts to LLMs
- Clean and validate JSON responses before parsing
- Use the correct Python virtual environment path in shebang lines
- Add comprehensive error logging for debugging
- When using LLMs for structured output, include example formats in the prompt
- Stop environment variable loading once required variables are found
- Use module-level flags to prevent duplicate initialization

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