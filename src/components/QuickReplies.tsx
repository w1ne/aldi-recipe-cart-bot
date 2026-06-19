interface QuickRepliesProps {
  onPick: (text: string) => void;
  disabled?: boolean;
}

const SUGGESTIONS = [
  "🍝 I fancy pasta",
  "🍗 Something with chicken",
  "🥗 A quick salad",
  "🍕 Pizza night",
];

/**
 * Row of tappable suggestion chips shown on first load to kick off the chat.
 */
export default function QuickReplies({ onPick, disabled }: QuickRepliesProps) {
  return (
    <div className="quick-replies" role="group" aria-label="Suggestions">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          type="button"
          className="quick-replies__chip"
          onClick={() => onPick(s)}
          disabled={disabled}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
