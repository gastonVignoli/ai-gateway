// src/providers/types.ts
export interface LLMProvider {
  name: string;
  complete(prompt: string): Promise<{ text: string; inputTokens: number; outputTokens: number }>;
}