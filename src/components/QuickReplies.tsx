import { useI18n } from "../lib/i18n";
import type { TKey } from "../lib/i18n";

interface QuickRepliesProps {
  onPick: (text: string) => void;
  disabled?: boolean;
}

const SUGGESTION_KEYS: TKey[] = [
  "quick.pasta",
  "quick.chicken",
  "quick.salad",
  "quick.pizza",
];

/**
 * Row of tappable suggestion chips shown on first load to kick off the chat.
 */
export default function QuickReplies({ onPick, disabled }: QuickRepliesProps) {
  const { t } = useI18n();
  return (
    <div className="quick-replies" role="group" aria-label="Suggestions">
      {SUGGESTION_KEYS.map((key) => {
        const label = t(key);
        return (
          <button
            key={key}
            type="button"
            className="quick-replies__chip"
            onClick={() => onPick(label)}
            disabled={disabled}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
