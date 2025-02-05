import { classifyThemes } from './src/themeClassifier';

const sampleText = `Wealth is not about having a lot of money; it's about having a lot of options. The most important skill for getting rich is becoming a perpetual learner. Reading a lot helps. You should be able to pick up any book in the library and read it.`;

async function testThemeClassification() {
    try {
        console.log('Sample text:', sampleText);
        console.log('\nClassifying themes...');
        const result = await classifyThemes(sampleText);
        console.log('\nClassification result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

testThemeClassification();
