// Cloudflare Pages Function: POST /api/chat
// Streams the ALDI Recipe-to-Cart assistant via the Vercel AI SDK 5. Replies
// stream token-by-token and tool results are emitted as UI-message tool parts
// so the client renders live generative-UI cards. Falls back to a keyless demo
// flow (no LLM) so the live link always works.
//
// IMPORTANT (Cloudflare): there is no `process.env` in Workers/Pages Functions.
// The bare `openai()` provider reads process.env and fails silently, so we
// construct the provider explicitly from `context.env`.
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { SYSTEM_PROMPT, dispatchTool } from "../../src/lib/tools";
import { listStores, searchRecipes } from "../../src/lib/aldi";
import type { Artifact, ChatMessage } from "../../src/lib/types";
// Pure, React-free language module — safe in the worker (no React bundled).
import { asLang, langInstruction } from "../../src/lib/lang";

interface Env {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
}

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

// The shape every tool's `execute` returns. This object becomes the tool part's
// `output` on the client, which renders the matching showpiece component from
// `artifact`. `summary` is the compact text the model reads back.
interface ToolOutput {
  summary: unknown;
  artifact?: Artifact;
}

// Build the four AI SDK tools. Each `execute` reuses the SAME grounded logic as
// the legacy hand-rolled dispatcher (real ALDI API calls — the model can't
// invent products), then returns both a compact summary for the model and the
// rich Artifact for the UI.
const aiTools = {
  search_recipes: tool({
    description:
      "Search ALDI recipes by a free-text query (dish, cuisine, or ingredient) and/or a tag. Use when the user names something they fancy.",
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe("dish/ingredient/cuisine, e.g. 'pasta', 'chicken'"),
      tag: z.string().optional().describe("optional tag filter, e.g. 'vegetarian'"),
    }),
    execute: async ({ query, tag }): Promise<ToolOutput> => {
      const { forModel, artifact } = await dispatchTool("search_recipes", { query, tag });
      return { summary: forModel, artifact };
    },
  }),
  get_recipe: tool({
    description:
      "Fetch full recipe detail with ALDI product options per ingredient, scaled to the requested portions. Set exclude_pantry true to drop household staples the user already owns.",
    inputSchema: z.object({
      recipe_id: z.number(),
      portions: z.number().optional().describe("people to cook for; scales amounts"),
      exclude_pantry: z.boolean().optional().describe("skip salt/oil/sugar/pepper etc."),
    }),
    execute: async ({ recipe_id, portions, exclude_pantry }): Promise<ToolOutput> => {
      const { forModel, artifact } = await dispatchTool("get_recipe", {
        recipe_id,
        portions,
        exclude_pantry,
      });
      return { summary: forModel, artifact };
    },
  }),
  list_stores: tool({
    description: "List ALDI stores the user can choose from for routing.",
    inputSchema: z.object({}),
    execute: async (): Promise<ToolOutput> => {
      const { forModel, artifact } = await dispatchTool("list_stores", {});
      return { summary: forModel, artifact };
    },
  }),
  plan_route: tool({
    description:
      "Plan the shortest in-store route through the 9x9 grid to collect every ingredient of a recipe and end at checkout, for a chosen store.",
    inputSchema: z.object({
      store_id: z.number(),
      recipe_id: z.number(),
      exclude_pantry: z.boolean().optional(),
    }),
    execute: async ({ store_id, recipe_id, exclude_pantry }): Promise<ToolOutput> => {
      const { forModel, artifact } = await dispatchTool("plan_route", {
        store_id,
        recipe_id,
        exclude_pantry,
      });
      return { summary: forModel, artifact };
    },
  }),
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let messages: UIMessage[];
  let language = asLang(undefined);
  try {
    const body = (await context.request.json()) as {
      messages?: UIMessage[];
      language?: unknown;
    };
    if (!Array.isArray(body?.messages)) {
      return json({ error: "Bad request: expected { messages: UIMessage[] }" }, 400);
    }
    messages = body.messages;
    language = asLang(body.language);
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const apiKey = context.env.OPENAI_API_KEY;

  // ---- Keyless demo mode: stream a scripted UI message (no LLM). ----
  if (!apiKey) {
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        await demoStream(writer, messages);
      },
      onError: (err) => (err instanceof Error ? err.message : "An error occurred."),
    });
    return createUIMessageStreamResponse({ stream, headers: CORS_HEADERS });
  }

  // ---- Full conversational mode via the AI SDK. ----
  const openai = createOpenAI({ apiKey });
  const model = context.env.OPENAI_MODEL || "gpt-4o";

  const result = streamText({
    model: openai(model),
    system: `${SYSTEM_PROMPT}\n\n${langInstruction(language)}`,
    messages: convertToModelMessages(messages),
    tools: aiTools,
    stopWhen: stepCountIs(6),
  });

  return result.toUIMessageStreamResponse({ headers: CORS_HEADERS });
};

// ---------------------------------------------------------------------------
// Keyless demo mode: a deterministic scripted flow over the real ALDI API so
// the live link works even before OPENAI_API_KEY is configured. No LLM calls.
// We emit text chunks (streamed prose) plus a tool part carrying the Artifact,
// so the client's useChat renders prose + the matching showpiece card exactly
// like the real model path.
// ---------------------------------------------------------------------------

// Flatten a UIMessage back to plain prose for the scripted matcher.
function messageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ");
}

async function demoStream(
  writer: { write: (chunk: UIMessageChunk) => void },
  uiMessages: UIMessage[],
): Promise<void> {
  // Reduce UI messages to the legacy {role, content} prose history.
  const messages: ChatMessage[] = uiMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: messageText(m) }));

  const { message, toolName, output } = await demoRespond(messages);

  writer.write({ type: "start" });

  // Stream the prose word-by-word so the demo also feels live.
  const textId = "demo-text";
  writer.write({ type: "text-start", id: textId });
  for (const chunk of message.match(/\S+\s*/g) ?? [message]) {
    writer.write({ type: "text-delta", id: textId, delta: chunk });
  }
  writer.write({ type: "text-end", id: textId });

  // Emit the artifact as a completed tool part the client renders.
  if (toolName && output) {
    const toolCallId = `demo-${toolName}`;
    writer.write({ type: "tool-input-available", toolCallId, toolName, input: {} });
    writer.write({ type: "tool-output-available", toolCallId, output });
  }

  writer.write({ type: "finish" });
}

interface DemoResult {
  message: string;
  toolName?: string;
  output?: ToolOutput;
}

async function demoRespond(messages: ChatMessage[]): Promise<DemoResult> {
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

  // Route intent (needs a previously chosen recipe).
  if (wantsRoute && matchedRecipe) {
    const store = matchedStore ?? stores[0];
    const { forModel, artifact } = await dispatchTool("plan_route", {
      store_id: store.id,
      recipe_id: matchedRecipe.id,
      exclude_pantry: true,
    });
    const steps = (forModel as { total_steps?: number }).total_steps ?? 0;
    return {
      message:
        `Here's the smartest route through **${store.name}** for ${matchedRecipe.name} — ${steps} steps, ending at the checkout. 🛒` +
        note,
      toolName: "plan_route",
      output: { summary: forModel, artifact },
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
    const { forModel, artifact } = await dispatchTool("get_recipe", {
      recipe_id: matchedRecipe.id,
      portions,
      exclude_pantry: true,
    });
    return {
      message:
        `Great choice — **${matchedRecipe.name}** for ${portions}. I've matched each ingredient to ALDI products and skipped common pantry staples. Flip the basket between best value and best ALDI margin, then tell me which store to route you through.` +
        note,
      toolName: "get_recipe",
      output: { summary: forModel, artifact },
    };
  }

  // Default: recipe search.
  const { forModel, artifact } = await dispatchTool("search_recipes", { query: lastUser });
  const found = artifact?.type === "recipes" ? artifact.recipes.length : 0;
  const message = found
    ? `Here are some recipes you might fancy. Tap one and I'll build your ALDI basket and route.` + note
    : `Tell me a dish you love — try "pasta", "something with chicken", "a quick salad" or "pizza night".` + note;
  return { message, toolName: "search_recipes", output: { summary: forModel, artifact } };
}
