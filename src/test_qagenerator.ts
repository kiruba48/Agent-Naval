import { generateQAPairsForChunks } from './qagenerator';

async function testQAGeneration() {
  const sampleChunks = [
    {
      text: "This is a sample section of text extracted from the document. It discusses the importance of mindfulness and regular breaks in a workday.",
      sourceReference: "Sample Document, Chapter 1, Paragraph 1"
    }
  ];
  try {
    const qaPairs = await generateQAPairsForChunks(sampleChunks);
    console.log("Generated Q&A pairs:", qaPairs);
  } catch (error) {
    console.error("Error generating Q&A pairs:", error);
  }
}

testQAGeneration();
