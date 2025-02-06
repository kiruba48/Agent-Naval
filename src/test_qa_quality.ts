import { runQAPipeline } from './qa_pipeline';
import path from 'path';
import fs from 'fs';

async function testQAQuality() {
  console.log('Starting QA quality test...');

  // Use programming concepts text file for testing
  const inputFile = path.join(process.cwd(), 'data', 'programming-concepts.txt');
  console.log('Input file:', inputFile);

  try {
    // Run the pipeline
    const qaPairs = await runQAPipeline(inputFile);
    
    // Analyze results
    const totalPairs = qaPairs.length;
    const reviewRequired = qaPairs.filter(pair => pair.requiresReview).length;
    const passedQuality = qaPairs.filter(pair => !pair.requiresReview).length;
    
    // Create summary
    const summary = {
      totalPairs,
      statistics: {
        reviewRequired,
        passedQuality,
        reviewPercentage: ((reviewRequired / totalPairs) * 100).toFixed(2) + '%',
        passPercentage: ((passedQuality / totalPairs) * 100).toFixed(2) + '%'
      },
      qaPairs
    };
    
    // Ensure tmp directory exists
    const outputPath = path.join(process.cwd(), 'tmp', 'qa_quality_test_results.json');
    const tmpDir = path.dirname(outputPath);
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    // Save results
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
    
    // Print summary
    console.log('\nTest Results Summary:');
    console.log('-------------------');
    console.log(`Total Q&A pairs generated: ${totalPairs}`);
    console.log(`Pairs requiring review: ${reviewRequired} (${summary.statistics.reviewPercentage})`);
    console.log(`Pairs passed quality check: ${passedQuality} (${summary.statistics.passPercentage})`);
    console.log(`\nDetailed results saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('Error during QA quality test:', error);
  }
}

// Run the test
testQAQuality();
