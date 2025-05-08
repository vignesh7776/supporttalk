'use server';

import { summarizeCall, type SummarizeCallInput, type SummarizeCallOutput } from '@/ai/flows/summarize-call';

export async function handleSummarizeTranscript(callTranscript: string): Promise<SummarizeCallOutput | { error: string }> {
  if (!callTranscript || callTranscript.trim().length === 0) {
    return { error: 'Transcript is empty. Cannot summarize.' };
  }

  try {
    const input: SummarizeCallInput = { callTranscript };
    const result = await summarizeCall(input);
    return result;
  } catch (error) {
    console.error('Error summarizing transcript:', error);
    return { error: 'Failed to summarize transcript. Please try again.' };
  }
}
