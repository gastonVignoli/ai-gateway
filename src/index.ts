/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { MockProvider } from "./providers/mock";
import { LLMProvider } from "./providers/types";
import { AnthropicProvider } from "./providers/anthropic";


export interface Env {
	ANTHROPIC_API_KEY: string;
	ai_gateway_db: D1Database;
}




export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/v1/chat" && request.method === "POST") {
			return handleChat(request, env);   // <-- called here
		}
		if (url.pathname === "/v1/usage" && request.method === "GET") {
			return handleUsage(request, env);
		}

		return new Response("Not found", { status: 404 });
	},
};

function getProvider(env: Env): LLMProvider {
	if (env.ANTHROPIC_API_KEY) {
		return new AnthropicProvider(env.ANTHROPIC_API_KEY);
	}

	return new MockProvider();
}


async function handleChat(request: Request, env: Env): Promise<Response> {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return jsonResponse({ error: "Invalid JSON body" }, 400);
	}

	if (
		typeof body !== "object" ||
		body === null ||
		!("prompt" in body) ||
		typeof (body as { prompt: unknown }).prompt !== "string" ||
		(body as { prompt: string }).prompt.trim() === ""
	) {
		return jsonResponse({ error: "'prompt' (non-empty string) is required" }, 400);
	}

	const { prompt } = body as { prompt: string };
	const provider: LLMProvider = getProvider(env);

	try {
		const result = await provider.complete(prompt);

		const apiKey = request.headers.get("x-api-key") ?? "anonymous";
		await recordUsage(env.ai_gateway_db, apiKey, result.inputTokens, result.outputTokens);
		return jsonResponse(
			{
				reply: result.text,
				provider: provider.name,
				usage: {
					inputTokens: result.inputTokens,
					outputTokens: result.outputTokens,
				},
			},
			200
		);
	} catch (err) {
		console.error("Provider error:", err instanceof Error ? err.message : err);
		return jsonResponse({ error: "Provider call failed" }, 502);
	}
}

function jsonResponse(data: Record<string, unknown>, status: number): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

async function recordUsage(
	db: D1Database,
	apiKey: string,
	inputTokens: number,
	outputTokens: number
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO usage (api_key, requests, input_tokens, output_tokens, updated_at)
       VALUES (?1, 1, ?2, ?3, datetime('now'))
       ON CONFLICT(api_key) DO UPDATE SET
         requests      = requests + 1,
         input_tokens  = input_tokens + ?2,
         output_tokens = output_tokens + ?3,
         updated_at    = datetime('now')`
		)
		.bind(apiKey, inputTokens, outputTokens)
		.run();
}



// Handle Usage ----------------




async function handleUsage(request: Request, env: Env): Promise<Response> {
	const apiKey = request.headers.get("x-api-key")
		?? new URL(request.url).searchParams.get("key")
		?? "anonymous";

	const row = await env.ai_gateway_db
		.prepare(`SELECT api_key, requests, input_tokens, output_tokens, updated_at FROM usage WHERE api_key = ?1`)
		.bind(apiKey)
		.first();

	if (!row) {
		return jsonResponse({ apiKey, requests: 0, inputTokens: 0, outputTokens: 0 }, 200);
	}

	return jsonResponse(
		{
			apiKey: row.api_key,
			requests: row.requests,
			inputTokens: row.input_tokens,
			outputTokens: row.output_tokens,
			updatedAt: row.updated_at,
		},
		200
	);
}


