import type { Artifact, RecipeDetail } from "../lib/types";
import type { ChatUIMessage } from "../lib/aiChat";
import { selectionFor } from "../lib/basket";

// Showpiece components — rendered from the tool parts of the streamed message.
import RecipeCard from "./RecipeCard";
import ProductOptions from "./ProductOptions";
import BasketPanel from "./BasketPanel";
import RouteGuide from "./RouteGuide";
import Markdown from "./Markdown";
import StoreMap from "./StoreMap";

interface MessageProps {
  message: ChatUIMessage;
  /** Programmatic send used by interactive artifacts (recipe pick, store pick…). */
  onSend: (text: string) => void;
  disabled?: boolean;
  /** Most-recent recipe in the conversation, so the route guide lists products. */
  recipe?: RecipeDetail;
}

/**
 * Renders one streamed UI message. Text parts become prose bubbles; tool parts
 * (once `output-available`) render the matching showpiece component from the
 * Artifact in their output.
 */
export default function ChatMessage({ message, onSend, disabled, recipe }: MessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`msg ${isUser ? "msg--user" : "msg--assistant"}`}>
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          if (!part.text) return null;
          return (
            <div className="bubble" key={i}>
              <Markdown className="bubble__text" text={part.text} />
            </div>
          );
        }

        // Tool parts: `tool-<name>`. Render the artifact once output is ready.
        if (part.type.startsWith("tool-") && "state" in part) {
          if (part.state === "output-available") {
            const output = part.output as { artifact?: Artifact } | undefined;
            if (output?.artifact) {
              return (
                <div className="artifacts" key={i}>
                  <ArtifactView
                    artifact={output.artifact}
                    onSend={onSend}
                    disabled={disabled}
                    recipe={recipe}
                  />
                </div>
              );
            }
            return null;
          }
          // input-streaming / input-available: a tool is running — show a hint.
          return (
            <div className="msg msg--assistant" key={i}>
              <div className="bubble bubble--typing" aria-label="Working on it">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

function ArtifactView({
  artifact,
  onSend,
  disabled,
  recipe,
}: {
  artifact: Artifact;
  onSend: (text: string) => void;
  disabled?: boolean;
  recipe?: RecipeDetail;
}) {
  switch (artifact.type) {
    case "recipes":
      return (
        <div className="artifact artifact--recipes">
          {artifact.recipes.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              onSelect={(_, persons) => onSend(`I'll have ${r.name} for ${persons} people`)}
            />
          ))}
        </div>
      );

    case "recipe":
      return <RecipeArtifact detail={artifact.detail} />;

    case "stores":
      return (
        <div className="artifact artifact--stores">
          <StoreMap stores={artifact.stores} onPick={onSend} disabled={disabled} />
        </div>
      );

    case "route":
      return (
        <div className="artifact artifact--route">
          <RouteGuide grid={artifact.grid} plan={artifact.plan} recipe={recipe} />
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
  // The basket is always the ALDI-margin-maximising pick — no mode toggle.
  const selection = selectionFor(detail, "profit");

  const ingredients = detail.ingredients.filter((i) => i.include_in_shopping_list);

  return (
    <div className="artifact artifact--recipe">
      <BasketPanel detail={detail} selection={selection} />
      <div className="ingredient-list">
        {ingredients.map((ing) => (
          <ProductOptions
            key={ing.ingredient_key}
            ingredient={ing}
            mode="profit"
            chosenId={selection[ing.ingredient_key]}
          />
        ))}
      </div>
    </div>
  );
}
