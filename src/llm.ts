import { generateText } from 'ai';
import { openai } from './ai';

const model = openai("gpt-4");

export const answerMyQuestion = async (
    prompt: string,
  ) => {
    const { text } = await generateText({
      model,
      prompt,
    });
  
    return text;
  };

const answer = await answerMyQuestion(
"what is the chemical formula for dihydrogen monoxide?",
);

console.log(answer);