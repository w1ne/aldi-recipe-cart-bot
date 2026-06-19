// Cloudflare Pages Function: POST /api/tts
// Server-side OpenAI text-to-speech for the animated route guide. The OpenAI
// key stays in the Worker env and is never exposed to the browser. Returns
// audio/mpeg (MP3) bytes the client plays per guide step.
//
// Request:  { text: string, voice?: string, instructions?: string }
// Response: audio/mpeg  (or JSON { error } on failure / { silent: true } 204
//           when no key is configured, so the guide degrades to silent mode)
interface Env {
  OPENAI_API_KEY?: string;
  OPENAI_TTS_MODEL?: string;
}

const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";
const MAX_TEXT = 600; // keep clips short; guards against abuse/cost

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

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: { text?: unknown; voice?: unknown; instructions?: unknown };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
  if (!text) return json({ error: "Missing 'text'" }, 400);

  const apiKey = context.env.OPENAI_API_KEY;
  // No key → tell the client to run the guide silently (still fully animated).
  if (!apiKey) return new Response(null, { status: 204, headers: CORS_HEADERS });

  const voice = typeof body.voice === "string" && body.voice ? body.voice : "alloy";
  const instructions =
    typeof body.instructions === "string" && body.instructions
      ? body.instructions
      : "Speak in a warm, upbeat, helpful shop-assistant tone. Keep it natural and brisk.";

  try {
    const res = await fetch(OPENAI_TTS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: context.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
        input: text,
        voice,
        instructions,
        response_format: "mp3",
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: `TTS failed (${res.status}): ${detail.slice(0, 200)}` }, 502);
    }

    // Stream the MP3 straight back to the client, cacheable per identical text.
    return new Response(res.body, {
      status: 200,
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "public, max-age=86400",
        ...CORS_HEADERS,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
};
