import Chat from "./components/Chat";

const GREETING =
  "Hi! I'm your ALDI kitchen helper. 👋 Tell me a dish you fancy — like " +
  "“pasta”, “something with chicken”, or “pizza night” — and I'll find a " +
  "recipe, pick the right ALDI products for your basket, and even map the " +
  "smartest route through the store to checkout. What are we cooking?";

export default function App() {
  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true">ALDI</span>
          <div className="app__titles">
            <h1 className="app__title">Recipe&nbsp;Cart</h1>
            <p className="app__tagline">From craving to checkout</p>
          </div>
        </div>
      </header>

      <main className="app__main">
        <Chat greeting={GREETING} />
      </main>
    </div>
  );
}
