// Tiny fetch wrapper around the /api/chat function. Sends the full message
// history, returns the structured ChatResponse. On a non-2xx response it tries
// to surface the server-provided error message before throwing.
import type { ChatMessage, ChatRequest, ChatResponse } from "./types";

export async function sendChat(messages: ChatMessage[]): Promise<ChatResponse> {
  const body: ChatRequest = { messages };

  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't reach the assistant. Check your connection and try again.");
  }

  if (!res.ok) {
    throw new Error(await extractError(res));
  }

  return (await res.json()) as ChatResponse;
}

async function extractError(res: Response): Promise<string> {
  // The function may return { error: "..." } or { message: "..." }, or plain text.
  try {
    const data = (await res.clone().json()) as { error?: unknown; message?: unknown };
    const msg = data?.error ?? data?.message;
    if (typeof msg === "string" && msg.trim()) return msg;
  } catch {
    // not JSON
  }
  try {
    const text = (await res.text()).trim();
    if (text) return text;
  } catch {
    // ignore
  }
  return `Request failed (${res.status})`;
}
