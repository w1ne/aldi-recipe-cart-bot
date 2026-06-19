import { useState } from "react";
import type {
  Artifact,
  OptimizeMode,
  RecipeDetail,
} from "../lib/types";
import { selectionFor } from "../lib/basket";

// Showpiece components owned by another agent. These files may not exist yet
// while the chat shell is built — the imports are written ahead of integration.
import RecipeCard from "./RecipeCard";
import ProductOptions from "./ProductOptions";
import BasketPanel from "./BasketPanel";
import StoreGrid from "./StoreGrid";

export interface Turn {
  role: "user" | "assistant";
  content: string;
  artifacts?: Artifact[];
  error?: boolean;
  pending?: boolean;
}

interface ChatMessageProps {
  turn: Turn;
  /** Programmatic send used by interactive artifacts (recipe pick, store pick…). */
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatMessage({ turn, onSend, disabled }: ChatMessageProps) {
  const isUser = turn.role === "user";

  return (
    <div className={`msg ${isUser ? "msg--user" : "msg--assistant"}`}>
      <div className={`bubble ${turn.error ? "bubble--error" : ""}`}>
        <p className="bubble__text">{turn.content}</p>
        {turn.error && (
          <button
            type="button"
            className="bubble__retry"
            onClick={() => onSend("__retry__")}
            disabled={disabled}
          >
            Try again
          </button>
        )}
      </div>

      {turn.artifacts && turn.artifacts.length > 0 && (
        <div className="artifacts">
          {turn.artifacts.map((a, i) => (
            <ArtifactView key={i} artifact={a} onSend={onSend} disabled={disabled} />
          ))}
        </div>
      )}
    </div>
  );
}

function ArtifactView({
  artifact,
  onSend,
  disabled,
}: {
  artifact: Artifact;
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  switch (artifact.type) {
    case "recipes":
      return (
        <div className="artifact artifact--recipes">
          {artifact.recipes.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              onSelect={() => onSend(`I'll have ${r.name}`)}
            />
          ))}
        </div>
      );

    case "recipe":
      return <RecipeArtifact detail={artifact.detail} />;

    case "stores":
      return (
        <div className="artifact artifact--stores">
          {artifact.stores.map((s) => (
            <button
              key={s.id}
              type="button"
              className="store-chip"
              onClick={() => onSend(`Use store ${s.name}`)}
              disabled={disabled}
            >
              <span className="store-chip__pin" aria-hidden="true">📍</span>
              {s.name}
            </button>
          ))}
        </div>
      );

    case "route":
      return (
        <div className="artifact artifact--route">
          <StoreGrid grid={artifact.grid} plan={artifact.plan} animate />
        </div>
      );

    default:
      return null;
  }
}

/**
 * The recipe detail artifact: per-ingredient product options plus the basket
 * panel. Owns the optimize-mode state (default 'profit') and derives the
 * selection map from basket helpers.
 */
function RecipeArtifact({ detail }: { detail: RecipeDetail }) {
  const [mode, setMode] = useState<OptimizeMode>("profit");
  const selection = selectionFor(detail, mode);

  const ingredients = detail.ingredients.filter((i) => i.include_in_shopping_list);

  return (
    <div className="artifact artifact--recipe">
      <BasketPanel
        detail={detail}
        mode={mode}
        onModeChange={setMode}
        selection={selection}
      />
      <div className="ingredient-list">
        {ingredients.map((ing) => (
          <ProductOptions
            key={ing.ingredient_key}
            ingredient={ing}
            mode={mode}
            chosenId={selection[ing.ingredient_key]}
          />
        ))}
      </div>
    </div>
  );
}
