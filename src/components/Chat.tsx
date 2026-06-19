import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage as Msg } from "../lib/types";
import { sendChat } from "../lib/chatClient";
import ChatMessageView, { type Turn } from "./ChatMessage";
import ChatInput from "./ChatInput";
import QuickReplies from "./QuickReplies";

interface ChatProps {
  /** Initial assistant greeting (and any seed turns). */
  greeting: string;
}

const ERROR_TEXT =
  "Sorry — I hit a snag reaching the kitchen. Tap to try that again.";

export default function Chat({ greeting }: ChatProps) {
  const [turns, setTurns] = useState<Turn[]>([
    { role: "assistant", content: greeting },
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Last user text, so the error-bubble retry can resend it.
  const lastUserText = useRef<string>("");

  // Keep the view pinned to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns, loading]);

  const runTurn = useCallback(
    async (userText: string, history: Turn[]) => {
      lastUserText.current = userText;
      setLoading(true);

      // Build the wire history from the conversation (prose only).
      const wire: Msg[] = history
        .filter((t) => !t.error && !t.pending)
        .map((t) => ({ role: t.role, content: t.content }));

      try {
        const res = await sendChat(wire);
        setTurns((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.message,
            artifacts: res.artifacts,
          },
        ]);
      } catch (err) {
        const detail = err instanceof Error ? err.message : ERROR_TEXT;
        setTurns((prev) => [
          ...prev,
          { role: "assistant", content: detail, error: true },
        ]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleSend = useCallback(
    (text: string) => {
      if (loading) return;

      // Retry path: drop the trailing error bubble, resend last user text.
      if (text === "__retry__") {
        setTurns((prev) => {
          const cleaned = prev.filter((t) => !t.error);
          void runTurn(lastUserText.current, cleaned);
          return cleaned;
        });
        return;
      }

      const userTurn: Turn = { role: "user", content: text };
      setTurns((prev) => {
        const next = [...prev, userTurn];
        void runTurn(text, next);
        return next;
      });
    },
    [loading, runTurn]
  );

  const showQuickReplies = turns.length <= 1 && !loading;

  return (
    <div className="chat">
      <div className="chat__scroll" ref={scrollRef}>
        <div className="chat__messages">
          {turns.map((turn, i) => (
            <ChatMessageView
              key={i}
              turn={turn}
              onSend={handleSend}
              disabled={loading}
            />
          ))}

          {loading && (
            <div className="msg msg--assistant">
              <div className="bubble bubble--typing" aria-label="Assistant is typing">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          )}

          {showQuickReplies && (
            <QuickReplies onPick={handleSend} disabled={loading} />
          )}
        </div>
      </div>

      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  );
}
