// This is an autogenerated file from Firebase Studio.
'use server';

/**
 * @fileOverview Summarizes a customer call.
 *
 * - summarizeCall - A function that summarizes the customer call.
 * - SummarizeCallInput - The input type for the summarizeCall function.
 * - SummarizeCallOutput - The return type for the summarizeCall function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeCallInputSchema = z.object({
  callTranscript: z
    .string()
    .describe('The transcript of the customer call.'),
});
export type SummarizeCallInput = z.infer<typeof SummarizeCallInputSchema>;

const SummarizeCallOutputSchema = z.object({
  summary: z.string().describe('A summary of the customer call.'),
});
export type SummarizeCallOutput = z.infer<typeof SummarizeCallOutputSchema>;

export async function summarizeCall(input: SummarizeCallInput): Promise<SummarizeCallOutput> {
  return summarizeCallFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeCallPrompt',
  input: {schema: SummarizeCallInputSchema},
  output: {schema: SummarizeCallOutputSchema},
  prompt: `You are an expert support agent. Please summarize the following customer call transcript, extracting the main issues discussed and the resolutions provided. Keep the summary concise and to the point.\n\nCall Transcript:\n{{{callTranscript}}}`,
});

const summarizeCallFlow = ai.defineFlow(
  {
    name: 'summarizeCallFlow',
    inputSchema: SummarizeCallInputSchema,
    outputSchema: SummarizeCallOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
