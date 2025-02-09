import { firebaseService } from '../service';

const DEFAULT_THEMES = [
    {
        id: 'mindfulness',
        name: 'Mindfulness',
        description: 'Focus on mindfulness and meditation practices'
    },
    {
        id: 'productivity',
        name: 'Productivity',
        description: 'Tips and strategies for improving productivity'
    },
    {
        id: 'wealth',
        name: 'Wealth Building',
        description: 'Principles of building long-term wealth'
    },
    {
        id: 'happiness',
        name: 'Happiness',
        description: 'Understanding and cultivating happiness'
    },
    {
        id: 'relationships',
        name: 'Relationships',
        description: 'Building and maintaining meaningful relationships'
    },
    {
        id: 'health',
        name: 'Health & Wellness',
        description: 'Physical and mental health optimization'
    }
];

async function initializeThemes() {
    console.log('Initializing default themes...');
    
    try {
        for (const theme of DEFAULT_THEMES) {
            await firebaseService.addTheme(theme.id, theme.name, theme.description);
            console.log(`✅ Added theme: ${theme.name}`);
        }
        
        console.log('\n✨ All default themes initialized successfully!');
    } catch (error) {
        console.error('Error initializing themes:', error);
    }
}

// Run the initialization
initializeThemes().then(() => process.exit(0));
