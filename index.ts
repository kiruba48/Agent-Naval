import * as readlineSync from 'readline-sync';
import { createVectorStore } from './src/vectorStore';
import { answerQuery } from './src/queryEngine';
import { handleAuthFlow } from './src/auth/authFlow';
import { firebaseService } from './src/firebase/service';
import { conversationService } from './src/memory/services/ConversationService';
import { User } from 'firebase/auth';
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

// Cleanup function for graceful shutdown
async function cleanup() {
  console.log('\nCleaning up resources...');
  try {
    const sessions = await conversationService.getActiveSessions();
    for (const session of sessions) {
      await conversationService.completeSession(session.id);
    }
    await firebaseService.signOut();
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
  process.exit(0);
}

// Add global error and signal handlers
process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  await cleanup();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  await cleanup();
  process.exit(1);
});

// Handle termination signals
process.on('SIGINT', cleanup); // Ctrl+C
process.on('SIGTERM', cleanup); // Kill command

const COLLECTION_NAME = 'naval_collection';
const DATA_DIR = './data';

// Get all PDF and EPUB files from the data directory
function getDataFiles(): string[] {
  return fs
    .readdirSync(DATA_DIR)
    .filter((file) => file.endsWith('.pdf') || file.endsWith('.epub'))
    .map((file) => path.join(DATA_DIR, file));
}

// Initial file processing (only run once)
async function setup() {
  const files = getDataFiles();
  console.log(
    `📥 Processing ${files.length} files and creating vector store...`
  );
  await createVectorStore(files, COLLECTION_NAME);
}

// Interactive loop for user queries
async function main() {
  try {
    // Require authentication before proceeding
    let currentUser: User;
    try {
      currentUser = await handleAuthFlow();
      const userProfile = await firebaseService.getUserProfile(currentUser.uid);
      console.log(
        `\n👋 Welcome back, ${userProfile?.name || currentUser.email}!`
      );
    } catch (error) {
      console.error('Authentication failed:', error);
      process.exit(1);
    }

    if (!process.argv.includes('--skip-setup')) {
      await setup();
    }

    // Create a new conversation session
    const conversationSession = await conversationService.createSession(
      currentUser.uid
    );
    console.log(
      `\n🔄 Created new conversation session: ${conversationSession.id}`
    );

    console.log(
      "\n💬 Naval RAG Chatbot Ready! Ask a question or type 'exit' to quit."
    );
    console.log('Commands:');
    console.log('  • exit - Quit the application');
    console.log('  • prefs - View/Update your preferences');
    console.log('  • logout - Sign out');

    while (true) {
      const query = readlineSync.question('\n🔹 Your Question: ');
      const command = query.toLowerCase();

      if (command === 'exit') {
        console.log('\n👋 Signing out and exiting...');
        // Complete the conversation session before exiting
        await conversationService.completeSession(conversationSession.id);
        await firebaseService.signOut();
        console.log('✅ Successfully signed out!');
        console.log('Exiting application...');
        process.exit(0);
      }

      if (command === 'logout') {
        // Complete the conversation session before logging out
        await conversationService.completeSession(conversationSession.id);
        await firebaseService.signOut();
        console.log('\n👋 Signed out successfully!');
        console.log('Exiting application...');
        process.exit(0);
      }

      if (command === 'prefs') {
        await handlePreferences(currentUser.uid);
        continue;
      }

      const answer = await answerQuery(query, conversationSession.id, true);
      if (typeof answer === 'string') {
        console.log('\n💡 AI Response:', answer);
      } else {
        console.log('\n💡 AI Response:', answer.answer);
        console.log('🎯 Confidence:', answer.confidence);
        console.log('📚 Topics:', answer.topics.join(', '));
        if (answer.sources.length > 0) {
          console.log('\n📖 Key Sources:');
          answer.sources.forEach((source) => {
            console.log(
              `  • [${Math.round(source.relevance * 100)}% relevant] ${
                source.content
              }`
            );
          });
        }
      }
    }
  } catch (error) {
    console.error('Error in main:', error);
    process.exit(1);
  }
}

async function handlePreferences(uid: string) {
  console.log('\n⚙️ User Preferences');

  // Get available themes
  const availableThemes = await firebaseService.getAllThemes();
  if (availableThemes.length === 0) {
    console.log(
      '\n❌ No themes available. Please run the theme initialization script.'
    );
    return;
  }

  // Get current user preferences
  const profile = await firebaseService.getUserProfile(uid);
  console.log('\nCurrent Preferences:');
  if (profile?.preferences?.themes) {
    Object.entries(profile.preferences.themes).forEach(([themeId, data]) => {
      const theme = availableThemes.find((t) => t.id === themeId);
      if (theme) {
        console.log(`  • ${theme.name}: strength ${data.strength}`);
      }
    });
  } else {
    console.log('  No preferences set');
  }

  if (readlineSync.keyInYN('\nWould you like to update your preferences?')) {
    const themes: { [key: string]: { strength: number } } = {};

    console.log('\nAvailable themes:');
    availableThemes.forEach((theme) => {
      console.log(`\n${theme.name} - ${theme.description}`);
      const currentStrength =
        profile?.preferences?.themes?.[theme.id]?.strength;

      const strength = readlineSync.questionInt(
        `Strength (1-5)${
          currentStrength ? ` [current: ${currentStrength}]` : ''
        }: `,
        {
          limitMessage: 'Please enter a number between 1 and 5',
          limit: [1, 5],
        }
      );

      if (strength) {
        themes[theme.id] = { strength };
      }
    });

    await firebaseService.updateUserPreferences(uid, themes);
    console.log('\n✅ Preferences updated successfully!');
  }
}

// Run Setup & Start Chat
(async () => {
  await main();
})();
