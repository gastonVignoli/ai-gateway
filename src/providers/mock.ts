import type { LLMProvider } from "./types";

export class MockProvider implements LLMProvider {
  name = "mock";

  async complete(prompt: string){
    await new Promise((resolve) => setTimeout(resolve, 50));

    const canned = `This is a mock response for the prompt: "${prompt}"`;

    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(canned.length / 4);

    return { text: canned, inputTokens, outputTokens };
  }
}