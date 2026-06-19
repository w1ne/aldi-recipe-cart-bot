import Chat from "./components/Chat";
import { useI18n, LANGS } from "./lib/i18n";

export default function App() {
  const { t, lang, setLang } = useI18n();
  const currentFlag = LANGS.find((l) => l.code === lang)?.flag ?? "🌐";

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true">ALDI</span>
          <div className="app__titles">
            <h1 className="app__title">{t("app.title")}</h1>
            <p className="app__tagline">{t("app.tagline")}</p>
          </div>
        </div>

        <label className="app__lang" aria-label={t("lang.label")}>
          <span className="app__lang-flag" aria-hidden="true">{currentFlag}</span>
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
      </header>

      <main className="app__main">
        {/* Seed the greeting in the current language; keyed by lang so switching
            before sending re-seeds it in the new language. */}
        <Chat key={lang} greeting={t("app.greeting")} />
      </main>
    </div>
  );
}
