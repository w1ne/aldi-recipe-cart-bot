import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "./lang";

// Hybrid voice dictation hook.
//
// Primary path: the Web Speech API (Chrome/Safari) streams interim results so
// the composer fills live as the user speaks.
// Fallback path: when Web Speech is missing (Firefox, some iOS), record mic
// audio with MediaRecorder and POST the bytes to /api/transcribe, which returns
// { text } (or 204 when no server key is configured — handled as a no-op).
//
// The hook never owns the textarea value: it surfaces transcripts through the
// onTranscript callback so ChatInput stays the single source of truth.

const BCP47: Record<Lang, string> = {
  en: "en-US",
  ua: "uk-UA",
  ru: "ru-RU",
  hu: "hu-HU",
  es: "es-ES",
};

function getSpeechRecognition(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

function mediaRecorderSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

interface VoiceInputOptions {
  lang: Lang;
  // Called with the latest transcript (replaces the field while listening).
  onTranscript: (text: string) => void;
}

export interface VoiceInput {
  supported: boolean;
  listening: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

export function useVoiceInput({ lang, onTranscript }: VoiceInputOptions): VoiceInput {
  const [listening, setListening] = useState(false);

  // Keep the latest values in refs so async callbacks don't capture stale ones.
  const langRef = useRef(lang);
  const onTranscriptRef = useRef(onTranscript);
  langRef.current = lang;
  onTranscriptRef.current = onTranscript;

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Text already committed (final) before the current interim chunk.
  const baseTextRef = useRef("");

  const SpeechRecognitionCtor = getSpeechRecognition();
  const supported = !!SpeechRecognitionCtor || mediaRecorderSupported();

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // ── Web Speech path ──────────────────────────────────────────────────────
  const startWebSpeech = useCallback(
    (Ctor: SpeechRecognitionConstructor) => {
      const recognition = new Ctor();
      recognition.lang = BCP47[langRef.current] ?? "en-US";
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;
      baseTextRef.current = "";

      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) {
            baseTextRef.current = `${baseTextRef.current} ${text}`.trim();
          } else {
            interim += text;
          }
        }
        const combined = `${baseTextRef.current} ${interim}`.trim();
        onTranscriptRef.current(combined);
      };

      recognition.onerror = () => {
        // Permission denied / no-speech / network — fail silently, never crash.
        setListening(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        setListening(true);
      } catch {
        recognitionRef.current = null;
        setListening(false);
      }
    },
    [],
  );

  // ── MediaRecorder → /api/transcribe fallback ─────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        cleanupStream();
        mediaRecorderRef.current = null;
        const chunks = chunksRef.current;
        chunksRef.current = [];
        if (chunks.length === 0) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        try {
          const res = await fetch(`/api/transcribe?lang=${encodeURIComponent(langRef.current)}`, {
            method: "POST",
            headers: { "content-type": blob.type || "audio/webm" },
            body: blob,
          });
          // 204 → no server key configured; transcription unavailable, no-op.
          if (res.status === 204 || !res.ok) return;
          const data = (await res.json()) as { text?: string };
          const text = (data.text ?? "").trim();
          if (text) onTranscriptRef.current(text);
        } catch {
          // Network failure — silently ignore so the UI never crashes.
        }
      };

      recorder.start();
      setListening(true);
    } catch {
      // Permission denied / no device — fail silently.
      cleanupStream();
      mediaRecorderRef.current = null;
      setListening(false);
    }
  }, [cleanupStream]);

  const start = useCallback(() => {
    if (listening) return;
    if (SpeechRecognitionCtor) {
      startWebSpeech(SpeechRecognitionCtor);
    } else if (mediaRecorderSupported()) {
      void startRecording();
    }
  }, [listening, SpeechRecognitionCtor, startWebSpeech, startRecording]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        cleanupStream();
      }
    }
    setListening(false);
  }, [cleanupStream]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  // Stop everything on unmount.
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort?.();
      recognitionRef.current = null;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      cleanupStream();
    };
  }, [cleanupStream]);

  return { supported, listening, start, stop, toggle };
}
