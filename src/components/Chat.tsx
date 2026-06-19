import { useEffect, useMemo, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { ChatUIMessage } from "../lib/aiChat";
import { useI18n } from "../lib/i18n";
import MessageView from "./ChatMessage";
import ChatInput from "./ChatInput";
import QuickReplies from "./QuickReplies";

interface ChatProps {
  /** Initial assistant greeting (seeded as the first message). */
  greeting: string;
}

export default function Chat({ greeting }: ChatProps) {
  const { t, lang } = useI18n();

  // Seed the conversation with the assistant greeting as the first UI message.
  const initialMessages = useMemo<ChatUIMessage[]>(
    () => [
      {
        id: "greeting",
        role: "assistant",
        parts: [{ type: "text", text: greeting }],
      },
    ],
    [greeting],
  );

  // Keep the latest selected language available to the transport's body
  // resolver (which is created once) so each send carries the current lang.
  const langRef = useRef(lang);
  langRef.current = lang;

  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: "/api/chat",
        // `body` accepts a resolver; evaluated per request so switching language
        // is reflected on the very next message.
        body: () => ({ language: langRef.current }),
      }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat<ChatUIMessage>({
    transport,
    messages: initialMessages,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  // Keep the view pinned to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  // Programmatic + composer sends share one path.
  const handleSend = (text: string) => {
    if (busy) return;
    void sendMessage({ text });
  };

  // Show the typing skeleton only while a reply is in flight but no assistant
  // text has streamed in yet (avoids a bubble + skeleton flicker).
  const last = messages[messages.length - 1];
  const lastIsStreamingAssistant =
    last?.role === "assistant" &&
    last.parts.some((p) => p.type === "text" || (p.type.startsWith("tool-") && "state" in p));
  const showTyping = busy && !lastIsStreamingAssistant;

  // QuickReplies only on first load (greeting only, idle).
  const showQuickReplies = messages.length <= 1 && status === "ready";

  return (
    <div className="chat">
      <div className="chat__scroll" ref={scrollRef}>
        <div className="chat__messages">
          {messages.map((message) => (
            <MessageView key={message.id} message={message} onSend={handleSend} disabled={busy} />
          ))}

          {error && (
            <div className="msg msg--assistant">
              <div className="bubble bubble--error">
                <p className="bubble__text">{t("chat.error")}</p>
                <button
                  type="button"
                  className="bubble__retry"
                  onClick={() => {
                    const lastUser = [...messages]
                      .reverse()
                      .find((m) => m.role === "user");
                    const text = lastUser?.parts
                      .filter((p) => p.type === "text")
                      .map((p) => (p as { text: string }).text)
                      .join(" ");
                    if (text) handleSend(text);
                  }}
                  disabled={busy}
                >
                  {t("chat.retry")}
                </button>
              </div>
            </div>
          )}

          {showTyping && (
            <div className="msg msg--assistant">
              <div className="bubble bubble--typing" aria-label={t("chat.typing")}>
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          )}

          {showQuickReplies && <QuickReplies onPick={handleSend} disabled={busy} />}
        </div>
      </div>

      <ChatInput onSend={handleSend} disabled={busy} />
    </div>
  );
}
