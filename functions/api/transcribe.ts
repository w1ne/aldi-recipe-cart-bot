// Cloudflare Pages Function: POST /api/transcribe
// Server-side speech-to-text fallback (OpenAI) for browsers without the Web
// Speech API. The client records mic audio and POSTs the raw audio bytes; we
// forward to OpenAI's transcription endpoint. The OpenAI key stays in the
// Worker env and is never exposed to the browser.
//
// Request:  POST /api/transcribe?lang=en   body = audio bytes (e.g. audio/webm)
// Response: { text: string }  |  { error }  |  204 (no key → client uses Web Speech only)
interface Env {
  OPENAI_API_KEY?: string;
  OPENAI_TRANSCRIBE_MODEL?: string;
}

const OPENAI_TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB guard

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

// Map our internal language codes to ISO-639-1 for OpenAI (Ukrainian = "uk").
function toIso(lang: string | null): string | undefined {
  switch ((lang || "").toLowerCase()) {
    case "ua":
    case "uk":
      return "uk";
    case "ru":
      return "ru";
    case "hu":
      return "hu";
    case "es":
      return "es";
    case "en":
      return "en";
    default:
      return undefined;
  }
}

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const apiKey = context.env.OPENAI_API_KEY;
  // No key → tell the client to rely on the Web Speech API only.
  if (!apiKey) return new Response(null, { status: 204, headers: CORS_HEADERS });

  const audio = await context.request.arrayBuffer();
  if (!audio.byteLength) return json({ error: "Empty audio body" }, 400);
  if (audio.byteLength > MAX_BYTES) return json({ error: "Audio too large" }, 413);

  const url = new URL(context.request.url);
  const lang = toIso(url.searchParams.get("lang"));
  const contentType = context.request.headers.get("content-type") || "audio/webm";
  const ext = contentType.includes("mp4") || contentType.includes("mp4a")
    ? "mp4"
    : contentType.includes("ogg")
      ? "ogg"
      : contentType.includes("wav")
        ? "wav"
        : "webm";

  try {
    const form = new FormData();
    form.append("file", new File([audio], `audio.${ext}`, { type: contentType }));
    form.append("model", context.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe");
    form.append("response_format", "json");
    if (lang) form.append("language", lang);

    const res = await fetch(OPENAI_TRANSCRIBE_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: `Transcription failed (${res.status}): ${detail.slice(0, 200)}` }, 502);
    }

    const data = (await res.json()) as { text?: string };
    return json({ text: data.text ?? "" }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
};
