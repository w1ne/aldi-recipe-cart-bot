import { useRef, useState } from "react";
import { useI18n } from "../lib/i18n";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

/**
 * Bottom-anchored, mobile-first composer. Auto-grows up to a few rows,
 * submits on Enter (Shift+Enter for newline), and respects the iOS safe area.
 */
export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
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
