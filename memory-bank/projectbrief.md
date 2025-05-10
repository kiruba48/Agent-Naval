Below is a sample project brief section designed for integration with Cline in VSCode. You can include this as a foundational document within your project:

---

# Project Brief – Mentor Agent — Naval

**Overview**  
This document serves as the foundation for the Mentor Agent — Naval project. It defines the core requirements and goals, ensuring all subsequent files and discussions align with the overall scope. If a foundation document doesn’t exist at project start, this brief should be created immediately to serve as the definitive source of truth.

This project is ongoing and the current structure is as follows:

Key Files and Directories:

- Source Code:
  - `src/` - Main source code directory containing the core application logic
  - `index.ts` - Main entry point file
  - `types.ts` - Type definitions
- Configuration Files:

  - `tsconfig.json` - TypeScript configuration
  - `package.json` - Node.js package configuration
  - `pnpm-lock.yaml` - Package lock file for pnpm

- Documentation:

  - `INSTRUCTIONS.md`
  - `README.md`

- Data & Resources:
  - `data/` - Data files
  - `embeddings/` - Contains embedding files
  - `firebase/` - Firebase related configuration and scripts
  - `memory-bank/` - Memory storage related files for cline
  - `cache/` - Cache files
  - `node_modules/` - Dependencies

Tree structure of the files:

.
├── cache
│   ├── qa_pairs.jsonl
│   └── theme_classifications.json
├── data
│   ├── personality-beyond-social-and-beyond-human.pdf.pdf
│   └── personality-the-body-in-society.pdf
├── embeddings
│   └── naval_collection.json
├── firebase
│   └── database.rules.json
├── instructions
│   ├── instruction.md
│   └── instruction_memory_system.md
├── memory-bank
│   └── projectbrief.md
├── output
│   └── qa_pairs.json
├── src
│   ├── auth
│   ├── firebase
│   ├── memory
│   ├── tools
│   ├── types
│   ├── utils
│   ├── agent.ts
│   ├── ai.ts
│   ├── fileUtils.ts
│   ├── llm.ts
│   ├── memory.ts
│   ├── processFile.ts
│   ├── qa_pipeline.ts
│   ├── qagenerator.ts
│   ├── queryEngine.ts
│   ├── systemPrompt.ts
│   ├── test_qa_quality.ts
│   ├── test_qagenerator.ts
│   ├── themeCache.ts
│   ├── themeClassifier.ts
│   ├── toolRunner.ts
│   ├── ui.ts
│   ├── vectorStore.ts
│   └── viewEmbeddings.ts
├── tmp
│   ├── qa_quality_test_results.json
│   └── qa_quality_test_results.jsonl
├── INSTRUCTIONS.md
├── README.md
├── db.json
├── docker-compose.yml
├── index.ts
├── list-collections.ts
├── package.json
├── pnpm-lock.yaml
├── scratchpad.md
├── test-theme.ts
├── tsconfig.json
└── types.ts

---

## Key Objectives

- **Foundation Document for All Files**
  - Acts as the central reference point for project decisions and file structures.
- **Creation at Project Inception**

  - Establish at the very beginning of the project if it doesn't already exist.

- **Defines Core Requirements and Goals**

  - Outlines essential features such as text-based Q&A, realistic speech interaction, structured output, personalized user profiles, and a robust reading list knowledge base.
  - Sets the stage for architectural components including frontend interfaces, backend services (LLM-driven Q&A, STT, TTS, etc.), and data storage.

- **Source of Truth for Project Scope**
  - Provides a consistent, accessible reference that guides all future development, documentation, and architectural decisions.
  - Ensures every team member has a clear understanding of the project’s objectives and boundaries.

---

## Project Scope & Core Features

- **Project Name**: Mentor Agent — Naval
- **Primary Goal**: Deliver a personalized, self-development mentorship experience inspired by Naval Ravikant’s reading list.
- **Core Features**:
  - **Text-Based Q&A**: Answer user queries by retrieving and leveraging relevant reading list content.
  - **Speech Interaction**: Enable users to speak queries, with real-time transcription and natural-sounding, synthesized responses.
  - **Structured Output**: Support endpoints that return data in a strict JSON format for further processing.
  - **Personalized User Profiles**: Adapt responses based on user history, preferences, and reading progress.
  - **Robust Knowledge Base**: Ingest, process, and embed curated content from recommended readings.
  - **Conversation History**: Maintain session context to ensure coherent, continuous interaction.

---

**Purpose**  
This brief acts as the definitive foundation document for Mentor Agent — Naval. It is the starting point for every other file and artifact, ensuring clarity, alignment, and consistency across the entire project lifecycle.

---

Feel free to adjust or expand this brief to match evolving project needs.
