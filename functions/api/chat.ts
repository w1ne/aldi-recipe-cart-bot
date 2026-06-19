// Cloudflare Pages Function: POST /api/chat
// Proxies OpenAI Chat Completions and runs a tool-calling loop against the
// ALDI tools defined in src/lib/tools.ts. Returns assistant prose plus the
// ordered list of rich Artifacts the UI renders.
import { SYSTEM_PROMPT, TOOLS, dispatchTool } from "../../src/lib/tools";
import { listStores, searchRecipes } from "../../src/lib/aldi";
import type { Artifact, ChatRequest, ChatResponse, ChatMessage } from "../../src/lib/types";

interface Env {
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string;
}

const MAX_ITERATIONS = 6;
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

// Minimal shapes for the OpenAI Chat Completions response we consume.
interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OpenAIAssistantMessage {
  role: "assistant";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
}

interface OpenAIChatResponse {
  choices?: { message: OpenAIAssistantMessage }[];
  error?: { message: string };
}

function isChatRequest(value: unknown): value is ChatRequest {
  if (typeof value !== "object" || value === null) return false;
  const messages = (value as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) return false;
  return messages.every((m) => {
    if (typeof m !== "object" || m === null) return false;
    const msg = m as Partial<ChatMessage>;
    return (msg.role === "user" || msg.role === "assistant") && typeof msg.content === "string";
  });
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    let body: unknown;
    try {
      body = await context.request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    if (!isChatRequest(body)) {
      return json({ error: "Bad request: expected { messages: ChatMessage[] }" }, 400);
    }

    const apiKey = context.env.OPENAI_API_KEY;
    if (!apiKey) {
      // No key configured — fall back to a deterministic demo flow so the live
      // link still works for judges. Uses the real ALDI API, no LLM.
      return json(await demoRespond(body.messages), 200);
    }

    const model = context.env.OPENAI_MODEL || "gpt-4o";

    // Build the working OpenAI message list: system prompt + the conversation.
    // Typed loosely because tool/assistant turns carry fields outside ChatMessage.
    const oaMessages: unknown[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...body.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const artifacts: Artifact[] = [];

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const oaRes = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: oaMessages,
          tools: TOOLS,
          tool_choice: "auto",
        }),
      });

      if (!oaRes.ok) {
        const text = await oaRes.text();
        return json({ error: `OpenAI request failed (${oaRes.status}): ${text}` }, 500);
      }

      const data = (await oaRes.json()) as OpenAIChatResponse;
      if (data.error) {
        return json({ error: `OpenAI error: ${data.error.message}` }, 500);
      }

      const choice = data.choices?.[0]?.message;
      if (!choice) {
        return json({ error: "OpenAI returned no choices" }, 500);
      }

      const toolCalls = choice.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        // Final answer.
        const response: ChatResponse = { message: choice.content ?? "", artifacts };
        return json(response, 200);
      }

      // Append the assistant turn (with its tool_calls) before the tool results.
      oaMessages.push(choice);

      // Execute every tool call concurrently.
      const results = await Promise.all(
        toolCalls.map(async (call) => {
          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {};
          } catch {
            return { call, result: { forModel: { error: "invalid tool arguments JSON" } } };
          }
          const result = await dispatchTool(call.function.name, parsedArgs);
          return { call, result };
        }),
      );

      // Preserve call order for both the tool messages and the artifacts.
      for (const { call, result } of results) {
        oaMessages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result.forModel),
        });
        if (result.artifact) artifacts.push(result.artifact);
      }
    }

    return json({ error: "Tool loop exceeded maximum iterations" }, 500);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
};

// ---------------------------------------------------------------------------
// Keyless demo mode: a deterministic scripted flow over the real ALDI API so
// the live link works even before OPENAI_API_KEY is configured. No LLM calls.
// ---------------------------------------------------------------------------
async function demoRespond(messages: ChatMessage[]): Promise<ChatResponse> {
  const lastUser = ([...messages].reverse().find((m) => m.role === "user")?.content ?? "").trim();
  const lastLower = lastUser.toLowerCase();
  const history = messages.map((m) => m.content).join("\n").toLowerCase();
  const note = "  _(demo mode — add an OpenAI key for full conversational AI)_";

  const { recipes } = await searchRecipes();
  const matchedRecipe =
    recipes.find((r) => lastLower.includes(r.name.toLowerCase())) ||
    recipes.find((r) => history.includes(r.name.toLowerCase()));

  const { stores } = await listStores();
  const matchedStore = stores.find((s) => lastLower.includes(String(s.name).toLowerCase()));
  const wantsRoute = /\b(store|route|map|navigat|where|shop|aldi)\b/.test(lastLower) || !!matchedStore;

  const wrap = (r: { forModel: unknown; artifact?: Artifact }): Artifact[] =>
    r.artifact ? [r.artifact] : [];

  // Route intent (needs a previously chosen recipe).
  if (wantsRoute && matchedRecipe) {
    const store = matchedStore ?? stores[0];
    const r = await dispatchTool("plan_route", {
      store_id: store.id,
      recipe_id: matchedRecipe.id,
      exclude_pantry: true,
    });
    const steps = (r.forModel as { total_steps?: number }).total_steps ?? 0;
    return {
      message: `Here's the smartest route through **${store.name}** for ${matchedRecipe.name} — ${steps} steps, ending at the checkout. 🛒` + note,
      artifacts: wrap(r),
    };
  }

  // Recipe-selection intent.
  const picking =
    !!matchedRecipe &&
    (/\b(i'?ll have|pick|choose|select|this one|let'?s|make|i want|go with)\b/.test(lastLower) ||
      lastLower.includes(matchedRecipe.name.toLowerCase()));
  if (picking && matchedRecipe) {
    const m = lastLower.match(/(\d+)\s*(people|portions|servings|persons)/);
    const portions = m ? Number(m[1]) : 4;
    const r = await dispatchTool("get_recipe", {
      recipe_id: matchedRecipe.id,
      portions,
      exclude_pantry: true,
    });
    return {
      message: `Great choice — **${matchedRecipe.name}** for ${portions}. I've matched each ingredient to ALDI products and skipped common pantry staples. Flip the basket between best value and best ALDI margin, then tell me which store to route you through.` + note,
      artifacts: wrap(r),
    };
  }

  // Default: recipe search.
  const r = await dispatchTool("search_recipes", { query: lastUser });
  const found = r.artifact?.type === "recipes" ? r.artifact.recipes.length : 0;
  const message = found
    ? `Here are some recipes you might fancy. Tap one and I'll build your ALDI basket and route.` + note
    : `Tell me a dish you love — try "pasta", "something with chicken", "a quick salad" or "pizza night".` + note;
  return { message, artifacts: wrap(r) };
}
