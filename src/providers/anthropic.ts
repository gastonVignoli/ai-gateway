import type { LLMProvider } from "./types";
interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}


export class AnthropicProvider implements LLMProvider {
  name = "anthropic";

  constructor(private apiKey: string, private model: string = "claude-sonnet-4-5") {}

  async complete(prompt: string) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json()as AnthropicResponse;

    // Anthropic's Messages API returns content as an array of blocks;
    // we're only handling text blocks for this gateway
    const text = data.content
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text)
      .join("");

    return {
      text,
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
    };
  }
}