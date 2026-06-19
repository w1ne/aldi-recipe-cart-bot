import { useState } from "react";
import Chat from "./components/Chat";
import MyRecipes from "./components/MyRecipes";
import { useI18n, LANGS } from "./lib/i18n";
import { useSavedRecipes } from "./lib/savedRecipes";
import "./components/myrecipes.css";

export default function App() {
  const { t, lang, setLang } = useI18n();
  const saved = useSavedRecipes();
  const [recipesOpen, setRecipesOpen] = useState(false);

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true">ALDI</span>
          <div className="app__titles">
            <h1 className="app__title">{t("app.title")}</h1>
            <p className="app__tagline">{t("app.tagline")}</p>
          </div>

          <button
            type="button"
            className="app__myrecipes"
            onClick={() => setRecipesOpen(true)}
            aria-label="My Recipes"
            aria-haspopup="dialog"
          >
            <span className="app__myrecipes-heart" aria-hidden="true">
              ♥
            </span>
            {saved.length > 0 ? (
              <span className="app__myrecipes-count">{saved.length}</span>
            ) : null}
          </button>

          <label className="app__lang" aria-label={t("lang.label")}>
            <select
              className="app__lang-select"
              value={lang}
              onChange={(e) => setLang(e.target.value as typeof lang)}
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <main className="app__main">
        {/* Seed the greeting in the current language; keyed by lang so switching
            before sending re-seeds it in the new language. */}
        <Chat key={lang} greeting={t("app.greeting")} />
      </main>

      <MyRecipes open={recipesOpen} onClose={() => setRecipesOpen(false)} />
    </div>
  );
}
