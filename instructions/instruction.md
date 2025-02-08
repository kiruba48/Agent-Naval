Below is a **Product Requirements Document (PRD)** tailored for an AI mentorship app that offers both **text-based Q&A** and **realistic, speech-based** interaction. This PRD lays out the **project overview**, **features**, **requirements**, **data models**, and **API contracts** with explicit details so engineers can implement the system without ambiguity.

---

# 1. Project Overview

**Project Name**: “Mentor Agent — Naval”

**Primary Goal**:  
Provide a personalized self-development mentorship experience based on Naval Ravikant’s reading list. The user can interact **via text** or **realistic speech** (like talking to a human).

**Key Objectives**:
1. **Text-based Q&A**:  
   - Users ask questions, app returns answers based on curated reading list content.  
2. **Speech Interaction**:  
   - Users can **speak** questions, get responses in **human-like** synthesized voice.  
3. **Structured Output**:  
   - Where needed, the system can return answers in **JSON** or another structured format for downstream processing or analytics.  

**Architecture Summary** (High-Level):  
- **Frontend**: Web or mobile clients that capture user input (text or audio) and render responses (text or audio).  
- **Backend Services**:  
  1. **Q&A Service** (LLM + retrieval pipeline),  
  2. **STT Service** (Speech-to-Text),  
  3. **TTS Service** (Text-to-Speech),  
  4. **Orchestrator** (routes requests, manages conversation context).  
- **Data Stores**:  
  - **Vector DB** for chunked reading-list content.  
  - **Relational / NoSQL** DB for user profiles, session data.  

---

# 2. Features

1. **Text-Based Q&A**  
   - The system ingests user questions in text form and responds with contextually relevant answers.  

2. **Speech Interaction**  
   - Users can speak queries; the system transcribes them and uses the Q&A engine to respond in text, which is then synthesized back to audio.  

3. **Structured Data Output**  
   - Certain endpoints or user queries require a **JSON** response (e.g., “title,” “summary,” “tags,” etc.).  

4. **Personalized User Profiles**  
   - The system tailors suggestions based on user history, reading progress, or stated goals.  

5. **Reading List Knowledge Base**  
   - Content from Naval Ravikant’s recommended books (ingested, chunked, embedded) for retrieval-augmented generation.  

6. **Conversation History & Context**  
   - The system maintains a short memory of recent turns for continuity (speech or text).  

---

# 3. Requirements for Each Feature

### 3.1. Text-Based Q&A

- **Functional Requirements**  
  1. **User Query**: A user sends a text query (e.g., `POST /api/v1/chat` with JSON body containing `user_id`, `query`).  
  2. **Context Retrieval**: Backend retrieves the most relevant chunks from the vector DB based on the query embedding.  
  3. **LLM Response Generation**: The LLM (fine-tuned) produces an answer referencing retrieved chunks.  
  4. **Return Answer**: The system returns the answer as structured JSON.  

- **Non-Functional Requirements**  
  - Response time < 2 seconds for typical queries (excluding slow networks).  
  - Must handle up to 100 concurrent user sessions.

### 3.2. Speech Interaction

- **Functional Requirements**  
  1. **User Speaks**: Frontend captures audio input (e.g., PCM or WAV) and sends to `POST /api/v1/stt`.  
  2. **STT Service**: Transcribes audio to text.  
     - **Variable**: `stt_provider` (e.g., `"google"`, `"aws"`, `"azure"`, `"whisper"`).  
  3. **Q&A Service**: Uses transcribed text with the same retrieval-augmented pipeline.  
  4. **TTS Service**: Converts LLM’s textual answer to audio with a chosen voice.  
     - **Variable**: `tts_provider` (e.g., `"google"`, `"aws"`, `"azure"`, `"elevenlabs"`).  
  5. **Frontend Playback**: Returns audio stream or file URL for user to hear.  

- **Non-Functional Requirements**  
  - Average STT and TTS latency < 1 second for typical, short phrases.  
  - Audio data under 1 minute in length for each request.

### 3.3. Structured Data Output

- **Functional Requirements**  
  1. **JSON Schema**: The system can produce output in a specific JSON format when requested. For example:
     ```json
     {
       "title": "string",
       "summary": "string",
       "tags": ["string"]
     }
     ```
  2. **Prompt Directive**: The Q&A pipeline must instruct the LLM to output strictly in the desired format.  
  3. **Validation**: On receiving the LLM response, the system parses the JSON (e.g., `json.loads()` in Python) and validates required fields.  
  4. **Fallback**: If the model fails to produce valid JSON, either re-prompt or return an error code.  

### 3.4. Personalized User Profiles

- **Functional Requirements**  
  1. **Profile Data**: Store `user_id`, `name`, `preferences` (e.g., “interested in mindfulness”), reading progress, conversation history.  
  2. **Adaptive Responses**: Use `preferences` and `history` to tailor recommendations.  
  3. **Update Profile**: The system updates user data with each new Q&A or reading suggestion.  

### 3.5. Reading List Knowledge Base

- **Functional Requirements**  
  1. **Ingestion Pipeline**: Ability to ingest PDF/EPUB or blog URLs.  
  2. **Chunking & Embedding**: Each chunk must store `chunk_id`, `text_content`, `vector_embedding`, `metadata` (title, author, themes).  
  3. **Vector DB**: Provide similarity search (k-NN or cosine similarity).  

### 3.6. Conversation History & Context

- **Functional Requirements**  
  1. **Session Context**: For each user session, store the last N turns (user query + system response).  
  2. **Stateful Orchestration**: Keep track of conversation ID to retrieve relevant context from memory.  
  3. **Expiration**: Optionally limit the conversation memory after X minutes or X turns to save resources.

---

# 4. Data Models

Below are **key data structures** (in JSON-like pseudo-schema). These can be mapped to a **SQL** or **NoSQL** schema, or used directly in code.

### 4.1. `UserProfile`

```json
{
  "name": "user_schema",
  "schema": {
    "type": "object",
    "properties": {
      "user_id": {
        "type": "string",
        "description": "The unique identifier for the user, should adhere to UUID format."
      },
      "name": {
        "type": "string",
        "description": "The name of the user."
      },
      "preferences": {
        "type": "object",
        "description": "User's preferences information.",
        "properties": {
          "themes_of_interest": {
            "type": "array",
            "description": "List of themes the user is interested in.",
            "items": {
              "type": "string",
              "enum": [
                "mindfulness",
                "entrepreneurship"
              ]
            }
          }
        },
        "required": [
          "themes_of_interest"
        ],
        "additionalProperties": false
      },
      "reading_progress": {
        "type": "array",
        "description": "List of books the user is reading and their progress.",
        "items": {
          "type": "object",
          "properties": {
            "book_title": {
              "type": "string",
              "description": "The title of the book being read."
            },
            "last_chapter_read": {
              "type": "integer",
              "description": "The last chapter the user has read in the book."
            }
          },
          "required": [
            "book_title",
            "last_chapter_read"
          ],
          "additionalProperties": false
        }
      },
      "created_at": {
        "type": "string",
        "description": "Timestamp of when the user was created."
      },
      "updated_at": {
        "type": "string",
        "description": "Timestamp of the last update of user information."
      }
    },
    "required": [
      "user_id",
      "name",
      "preferences",
      "reading_progress",
      "created_at",
      "updated_at"
    ],
    "additionalProperties": false
  },
  "strict": true
}
```

### 4.2. `ProcessedChunk`

```json
{
  "name": "ProcessedChunk",
  "schema": {
    "type": "object",
    "properties": {
      "content": {
        "type": "string",
        "description": "The processed content in string format."
      },
      "sourceFile": {
        "type": "string",
        "description": "The name of the source file from which this chunk was processed."
      },
      "metadata": {
        "type": "object",
        "description": "Metadata associated with the content.",
        "properties": {
          "title": {
            "type": "string",
            "description": "The title of the content."
          },
          "author": {
            "type": "string",
            "description": "The author of the content."
          },
          "chapter": {
            "type": "string",
            "description": "The chapter of the content, if applicable."
          },
          "themes": {
            "type": "array",
            "description": "A list of themes related to the content.",
            "items": {
              "type": "string"
            }
          },
          "sourceReference": {
            "type": "string",
            "description": "A reference to the source of the content."
          }
        },
        "required": [
          "title",
          "author",
          "chapter",
          "themes",
          "sourceReference"
        ],
        "additionalProperties": false
      }
    },
    "required": [
      "content",
      "sourceFile",
      "metadata"
    ],
    "additionalProperties": false
  },
  "strict": true
}

```

### 4.3. `ConversationLog`

```json
{
  "name": "conversation_schema",
  "schema": {
    "type": "object",
    "properties": {
      "conversation_id": {
        "type": "string",
        "description": "The unique identifier for the conversation, formatted as a UUID."
      },
      "user_id": {
        "type": "string",
        "description": "The unique identifier for the user participating in the conversation."
      },
      "history": {
        "type": "array",
        "description": "A chronological history of the conversation's exchanges.",
        "items": {
          "type": "object",
          "properties": {
            "role": {
              "type": "string",
              "description": "The role of the participant in the conversation, either 'user' or 'assistant'."
            },
            "content": {
              "type": "string",
              "description": "The text content of the message."
            },
            "timestamp": {
              "type": "string",
              "description": "The time at which the message was sent, formatted as datetime."
            }
          },
          "required": [
            "role",
            "content",
            "timestamp"
          ],
          "additionalProperties": false
        }
      },
      "last_updated": {
        "type": "string",
        "description": "The last time the conversation was updated, formatted as datetime."
      }
    },
    "required": [
      "conversation_id",
      "user_id",
      "history",
      "last_updated"
    ],
    "additionalProperties": false
  },
  "strict": true
}
```

### 4.4. `StructuredAnswer` (Example)

```json
{
  "name": "StructuredAnswer",
  "schema": {
    "type": "object",
    "properties": {
      "answer": {
        "type": "string",
        "description": "The main answer text."
      },
      "confidence": {
        "type": "number",
        "description": "Confidence score between 0 and 1."
      },
      "sources": {
        "type": "array",
        "description": "Sources used in the answer.",
        "items": {
          "type": "object",
          "properties": {
            "content": {
              "type": "string",
              "description": "Content of the source."
            },
            "relevance": {
              "type": "number",
              "description": "Relevance score of the source."
            }
          },
          "required": [
            "content",
            "relevance"
          ],
          "additionalProperties": false
        }
      },
      "topics": {
        "type": "array",
        "description": "Main topics/themes discussed in the answer.",
        "items": {
          "type": "string"
        }
      }
    },
    "required": [
      "answer",
      "confidence",
      "sources",
      "topics"
    ],
    "additionalProperties": false
  },
  "strict": true
}
```

### 4.5. `ThemeClassificationResult` (Example)

```json
{
  "name": "theme_classification_result",
  "schema": {
    "type": "object",
    "properties": {
      "themes": {
        "type": "array",
        "description": "A list of themes identified in the classification result.",
        "items": {
          "type": "string"
        }
      },
      "confidence": {
        "type": "object",
        "description": "A mapping of themes to their associated confidence scores.",
        "properties": {
          "theme_name": {
            "type": "number",
            "description": "Confidence score for a specific theme."
          }
        },
        "additionalProperties": false,
        "required": [
          "theme_name"
        ]
      }
    },
    "required": [
      "themes",
      "confidence"
    ],
    "additionalProperties": false
  },
  "strict": true
}
```

*(Used when the user or an endpoint requests a structured response.)*

---

# 5. API Contract

Below is a sample set of RESTful endpoints. Modify paths or naming conventions to match your organization’s standards.

## 5.1. Q&A Endpoints

### **`POST /api/v1/chat`**  
**Description**: Handles a **text-based** user query, returns a text or structured response.

- **Request Body** (JSON):
  ```json
  {
    "user_id": "string",
    "query": "string",
    "structured_output": "boolean (optional, default: false)"
  }
  ```
  - `structured_output` indicates if the user wants a strict JSON schema.

- **Response** (JSON):
  ```json
  {
    "answer": "string or structured JSON",
    "metadata": {
      "source_chunks": [
        {
          "chunk_id": "string",
          "relevance_score": "float"
        }
      ]
    }
  }
  ```
  - If `structured_output = true`, `answer` should contain strictly formatted JSON as part of the field (e.g., it could be nested or the entire `answer` field might be valid JSON).

### **`POST /api/v1/chat/structured`**  
*(Alternatively, a separate endpoint dedicated to structured output.)*

## 5.2. Speech Endpoints

### **`POST /api/v1/stt`**  
**Description**: Accepts audio data, returns transcribed text.

- **Request**:
  - **Headers**: `Content-Type: audio/wav` or `audio/mpeg`  
  - **Body**: Binary audio data or streaming audio.  
  - **Query Params**: 
    - `stt_provider` (optional, default: "google")

- **Response** (JSON):
  ```json
  {
    "transcript": "string",
    "confidence": "float (optional)"
  }
  ```

### **`POST /api/v1/tts`**  
**Description**: Accepts a text string, returns audio data or a URL to an audio file.

- **Request Body** (JSON):
  ```json
  {
    "text": "string",
    "tts_provider": "string (e.g. 'google', 'aws', 'elevenlabs')",
    "voice_id": "string (optional, depends on provider)"
  }
  ```
  
- **Response** (JSON or Audio Stream**):
  ```json
  {
    "audio_url": "string (if you generate a file and store it)",
    "other_metadata": { "duration_ms": 2000 }
  }
  ```
  - Or direct audio bytes if responding with `Content-Type: audio/mpeg`.

## 5.3. User Profile Endpoints

### **`GET /api/v1/user/{user_id}`**
- **Response** (JSON):
  ```json
  {
    "user_id": "string",
    "name": "string",
    "preferences": {...},
    "reading_progress": [...],
    "created_at": "datetime",
    "updated_at": "datetime"
  }
  ```

### **`PUT /api/v1/user/{user_id}`**
- **Request Body** (JSON):
  ```json
  {
    "name": "string (optional)",
    "preferences": {
      "themes_of_interest": ["string"]
    },
    "reading_progress": [
      {
        "book_title": "string",
        "last_chapter_read": "int"
      }
    ]
  }
  ```
- **Response** (JSON): Updated `UserProfile`.

## 5.4. Data Ingestion / Chunking Endpoint

### **`POST /api/v1/data/ingest`**
- **Description**: Ingest new book or blog content.  
- **Request Body** (JSON):
  ```json
  {
    "source_url": "string (optional)",
    "book_title": "string",
    "author": "string",
    "raw_text": "string (entire text to chunk)",
    "chunk_size": 500,
    "overlap": 50,
    "themes": ["string (optional)"]
  }
  ```
- **Response** (JSON):
  ```json
  {
    "status": "success",
    "chunks_created": "int"
  }
  ```

---

## Summary

This PRD provides a **detailed roadmap** for engineers to implement a mentorship app that handles **text-based Q&A** and **speech-based** interaction with **structured output** options. By following the **Features**, **Requirements**, **Data Models**, and **API Contracts** outlined above, development teams can proceed with minimal ambiguity.

**Key Next Steps**:
1. **Align** on final endpoint naming and data field formats.  
2. **Decide** on the specific STT/TTS providers and confirm usage or cost constraints.  
3. **Set Up** the ingestion pipeline for the reading list content, ensuring it’s chunked and embedded properly.  
4. **Begin** implementing each feature in sprints, starting with the core Q&A pipeline, then layering on speech services and structured output.