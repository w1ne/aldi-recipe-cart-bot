import { useCallback, useRef, useState } from "react";
import { useI18n } from "../lib/i18n";
import { useVoiceInput } from "../lib/useVoiceInput";
import "./voice.css";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

// Mic button labels, kept local so the shared i18n dictionary stays lean.
const MIC: Record<string, { start: string; stop: string }> = {
  en: { start: "Dictate message", stop: "Stop dictation" },
  ua: { start: "Продиктувати повідомлення", stop: "Зупинити диктування" },
  ru: { start: "Продиктовать сообщение", stop: "Остановить диктовку" },
  hu: { start: "Üzenet diktálása", stop: "Diktálás leállítása" },
  es: { start: "Dictar mensaje", stop: "Detener dictado" },
};

/**
 * Bottom-anchored, mobile-first composer. Auto-grows up to a few rows,
 * submits on Enter (Shift+Enter for newline), and respects the iOS safe area.
 * A mic button (left of send) dictates the message via Web Speech, falling back
 * to a server transcribe endpoint when the browser lacks it.
 */
export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const { t, lang } = useI18n();
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const mic = MIC[lang] ?? MIC.en;

  const grow = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  // Voice transcript replaces the field with the latest text so the user can
  // glance/edit then hit send — we never auto-send.
  const onTranscript = useCallback(
    (text: string) => {
      setValue(text);
      // Let layout settle before measuring the new height.
      requestAnimationFrame(grow);
    },
    [grow],
  );

  const voice = useVoiceInput({ lang, onTranscript });

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    if (voice.listening) voice.stop();
    onSend(text);
    setValue("");
    // reset auto-grown height
    if (taRef.current) taRef.current.style.height = "auto";
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    setValue(el.value);
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="chat-input">
      <div className="chat-input__bar">
        <textarea
          ref={taRef}
          className="chat-input__field"
          rows={1}
          value={value}
          onChange={onInput}
          onKeyDown={onKeyDown}
          placeholder={t("input.placeholder")}
          enterKeyHint="send"
          aria-label="Message"
        />
        {voice.supported && (
          <button
            type="button"
            className={`chat-input__mic${voice.listening ? " is-listening" : ""}`}
            onClick={voice.toggle}
            disabled={disabled}
            aria-label={voice.listening ? mic.stop : mic.start}
            aria-pressed={voice.listening}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a1 1 0 0 1 2 0 7 7 0 0 1-6 6.92V21a1 1 0 0 1-2 0v-3.08A7 7 0 0 1 5 11a1 1 0 0 1 2 0 5 5 0 0 0 10 0z"
              />
            </svg>
          </button>
        )}
        <button
          type="button"
          className="chat-input__send"
          onClick={submit}
          disabled={!canSend}
          aria-label={t("input.send")}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              fill="currentColor"
              d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a.998.998 0 0 0-1.39 1.18L4.6 11 2 17.22c-.27.81.52 1.54 1.4 1.18z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
