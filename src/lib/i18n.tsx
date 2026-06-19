// Lightweight, dependency-free i18n for the 4 supported languages.
// Browser-detected on first load, overridable via a header switcher, persisted
// to localStorage. Internal codes: en, ua (Ukrainian), ru, hu.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LANGS, detectLang, langInstruction, asLang, type Lang } from "./lang";

// Re-export the React-free language metadata/helpers so the UI keeps one import
// surface. The pure module (lang.ts) is what the Cloudflare worker imports, so
// React never gets bundled into the worker.
export { LANGS, detectLang, langInstruction, asLang };
export type { Lang };

const STORAGE_KEY = "aldi.lang";

type Dict = Record<string, string>;

// Every UI string keyed once; one dict per language. Keep keys stable.
const STRINGS: Record<Lang, Dict> = {
  en: {
    "app.title": "Recipe Cart",
    "app.tagline": "From craving to checkout",
    "app.greeting":
      "Hi! Tell me a dish you fancy and I'll find a recipe, pick the right ALDI products, and map the smartest route through the store. 🛒",
    "lang.label": "Language",
    "quick.pasta": "🍝 Pasta night",
    "quick.chicken": "🍗 Something with chicken",
    "quick.salad": "🥗 A quick salad",
    "quick.pizza": "🍕 Pizza night",
    "input.placeholder": "Tell me a dish you love…",
    "input.send": "Send",
    "chat.typing": "Thinking…",
    "chat.error": "Something went wrong. Tap to retry.",
    "chat.retry": "Retry",
    "recipe.pick": "Pick this",
    "recipe.min": "min",
    "recipe.ingredients": "ingredients",
    "product.staple": "pantry staple",
    "basket.title": "Your basket · optimise it",
    "basket.youPay": "You pay",
    "basket.items": "items in cart",
    "route.steps": "steps",
    "route.pickupOrder": "Pickup order",
    "route.mapOf": "Store route map",
    "stores.use": "Use this store",
    "guide.title": "Your in-store guide",
    "guide.step": "Step {n} of {m}",
    "guide.grab": "Grab",
    "guide.headTo": "Head to {category}",
    "guide.entrance": "Welcome! Let's start your shopping trip.",
    "guide.play": "Play",
    "guide.pause": "Pause",
    "guide.next": "Next",
    "guide.back": "Back",
    "guide.start": "Start guide",
    "guide.replay": "Replay",
    "guide.checkout": "At the checkout — you pay {total}. Enjoy your meal!",
    "guide.done": "All done — happy cooking!",
    "guide.narrateHead": "Head to {category}.",
    "guide.narrateGrab": "Here, grab {items}.",
    "guide.narrateStart": "Welcome to ALDI! Let's begin. Head to your first stop.",
  },
  ua: {
    "app.title": "Кошик рецептів",
    "app.tagline": "Від ідеї до каси",
    "app.greeting":
      "Привіт! Назвіть страву, яку хочете, і я знайду рецепт, підберу потрібні продукти ALDI та прокладу найзручніший маршрут магазином. 🛒",
    "lang.label": "Мова",
    "quick.pasta": "🍝 Хочу пасту",
    "quick.chicken": "🍗 Щось із куркою",
    "quick.salad": "🥗 Швидкий салат",
    "quick.pizza": "🍕 Вечір піци",
    "input.placeholder": "Назвіть улюблену страву…",
    "input.send": "Надіслати",
    "chat.typing": "Думаю…",
    "chat.error": "Щось пішло не так. Торкніться, щоб повторити.",
    "chat.retry": "Повторити",
    "recipe.pick": "Обрати",
    "recipe.min": "хв",
    "recipe.ingredients": "інгредієнтів",
    "product.staple": "базовий продукт",
    "basket.title": "Ваш кошик · оптимізуйте його",
    "basket.youPay": "Ви платите",
    "basket.items": "товарів у кошику",
    "route.steps": "кроків",
    "route.pickupOrder": "Порядок збору",
    "route.mapOf": "Маршрут магазином",
    "stores.use": "Обрати магазин",
    "guide.title": "Ваш гід магазином",
    "guide.step": "Крок {n} з {m}",
    "guide.grab": "Візьміть",
    "guide.headTo": "Прямуйте до: {category}",
    "guide.entrance": "Вітаємо! Розпочнімо ваші покупки.",
    "guide.play": "Пуск",
    "guide.pause": "Пауза",
    "guide.next": "Далі",
    "guide.back": "Назад",
    "guide.start": "Почати гід",
    "guide.replay": "Повторити",
    "guide.checkout": "На касі — ви платите {total}. Смачного!",
    "guide.done": "Готово — смачної готування!",
    "guide.narrateHead": "Прямуйте до відділу: {category}.",
    "guide.narrateGrab": "Тут візьміть: {items}.",
    "guide.narrateStart": "Ласкаво просимо до ALDI! Починаймо. Прямуйте до першої зупинки.",
  },
  ru: {
    "app.title": "Корзина рецептов",
    "app.tagline": "От идеи до кассы",
    "app.greeting":
      "Привет! Назовите блюдо, которое хотите, а я найду рецепт, подберу нужные продукты ALDI и проложу удобный маршрут по магазину. 🛒",
    "lang.label": "Язык",
    "quick.pasta": "🍝 Хочу пасту",
    "quick.chicken": "🍗 Что-нибудь с курицей",
    "quick.salad": "🥗 Быстрый салат",
    "quick.pizza": "🍕 Вечер пиццы",
    "input.placeholder": "Назовите любимое блюдо…",
    "input.send": "Отправить",
    "chat.typing": "Думаю…",
    "chat.error": "Что-то пошло не так. Нажмите, чтобы повторить.",
    "chat.retry": "Повторить",
    "recipe.pick": "Выбрать",
    "recipe.min": "мин",
    "recipe.ingredients": "ингредиентов",
    "product.staple": "базовый продукт",
    "basket.title": "Ваша корзина · оптимизируйте её",
    "basket.youPay": "Вы платите",
    "basket.items": "товаров в корзине",
    "route.steps": "шагов",
    "route.pickupOrder": "Порядок сбора",
    "route.mapOf": "Маршрут по магазину",
    "stores.use": "Выбрать магазин",
    "guide.title": "Ваш гид по магазину",
    "guide.step": "Шаг {n} из {m}",
    "guide.grab": "Возьмите",
    "guide.headTo": "Идите к: {category}",
    "guide.entrance": "Добро пожаловать! Начнём покупки.",
    "guide.play": "Пуск",
    "guide.pause": "Пауза",
    "guide.next": "Далее",
    "guide.back": "Назад",
    "guide.start": "Начать гид",
    "guide.replay": "Повторить",
    "guide.checkout": "На кассе — вы платите {total}. Приятного аппетита!",
    "guide.done": "Готово — приятной готовки!",
    "guide.narrateHead": "Идите к отделу: {category}.",
    "guide.narrateGrab": "Здесь возьмите: {items}.",
    "guide.narrateStart": "Добро пожаловать в ALDI! Начнём. Идите к первой остановке.",
  },
  hu: {
    "app.title": "Recept Kosár",
    "app.tagline": "Az ötlettől a pénztárig",
    "app.greeting":
      "Szia! Mondj egy ételt, amit megkívántál, és keresek hozzá receptet, kiválasztom a megfelelő ALDI termékeket, és megtervezem a legjobb útvonalat a boltban. 🛒",
    "lang.label": "Nyelv",
    "quick.pasta": "🍝 Tésztát kívánok",
    "quick.chicken": "🍗 Valamit csirkével",
    "quick.salad": "🥗 Egy gyors saláta",
    "quick.pizza": "🍕 Pizza este",
    "input.placeholder": "Mondj egy kedvenc ételt…",
    "input.send": "Küldés",
    "chat.typing": "Gondolkozom…",
    "chat.error": "Valami hiba történt. Koppints az újrapróbáláshoz.",
    "chat.retry": "Újra",
    "recipe.pick": "Ezt kérem",
    "recipe.min": "perc",
    "recipe.ingredients": "hozzávaló",
    "product.staple": "alapélelmiszer",
    "basket.title": "A kosarad · optimalizáld",
    "basket.youPay": "Ön fizet",
    "basket.items": "tétel a kosárban",
    "route.steps": "lépés",
    "route.pickupOrder": "Felvételi sorrend",
    "route.mapOf": "Bolti útvonal",
    "stores.use": "Bolt kiválasztása",
    "guide.title": "Bolti útvonal-vezető",
    "guide.step": "{n}. lépés / {m}",
    "guide.grab": "Fogd meg",
    "guide.headTo": "Menj ide: {category}",
    "guide.entrance": "Üdvözlünk! Kezdjük a vásárlást.",
    "guide.play": "Lejátszás",
    "guide.pause": "Szünet",
    "guide.next": "Tovább",
    "guide.back": "Vissza",
    "guide.start": "Vezető indítása",
    "guide.replay": "Újra",
    "guide.checkout": "A pénztárnál — {total} fizetsz. Jó étvágyat!",
    "guide.done": "Kész — jó főzést!",
    "guide.narrateHead": "Menj a következő részleghez: {category}.",
    "guide.narrateGrab": "Itt fogd meg: {items}.",
    "guide.narrateStart": "Üdv az ALDI-ban! Kezdjük. Menj az első megállóhoz.",
  },
  es: {
    "app.title": "Cesta de Recetas",
    "app.tagline": "Del antojo a la caja",
    "app.greeting":
      "¡Hola! Dime un plato que te apetezca y buscaré una receta, elegiré los productos ALDI adecuados y trazaré la mejor ruta por la tienda. 🛒",
    "lang.label": "Idioma",
    "quick.pasta": "🍝 Me apetece pasta",
    "quick.chicken": "🍗 Algo con pollo",
    "quick.salad": "🥗 Una ensalada rápida",
    "quick.pizza": "🍕 Noche de pizza",
    "input.placeholder": "Dime un plato que te guste…",
    "input.send": "Enviar",
    "chat.typing": "Pensando…",
    "chat.error": "Algo salió mal. Toca para reintentar.",
    "chat.retry": "Reintentar",
    "recipe.pick": "Elegir",
    "recipe.min": "min",
    "recipe.ingredients": "ingredientes",
    "product.staple": "básico de despensa",
    "basket.title": "Tu cesta · optimízala",
    "basket.youPay": "Pagas",
    "basket.items": "artículos en la cesta",
    "route.steps": "pasos",
    "route.pickupOrder": "Orden de recogida",
    "route.mapOf": "Ruta por la tienda",
    "stores.use": "Elegir tienda",
    "guide.title": "Tu guía en la tienda",
    "guide.step": "Paso {n} de {m}",
    "guide.grab": "Coge",
    "guide.headTo": "Dirígete a {category}",
    "guide.entrance": "¡Bienvenido! Empecemos tu compra.",
    "guide.play": "Reproducir",
    "guide.pause": "Pausa",
    "guide.next": "Siguiente",
    "guide.back": "Atrás",
    "guide.start": "Iniciar guía",
    "guide.replay": "Repetir",
    "guide.checkout": "En la caja — pagas {total}. ¡Buen provecho!",
    "guide.done": "¡Listo, feliz cocina!",
    "guide.narrateHead": "Dirígete a la sección {category}.",
    "guide.narrateGrab": "Aquí, coge {items}.",
    "guide.narrateStart": "¡Bienvenido a ALDI! Empecemos. Dirígete a tu primera parada.",
  },
};

export type TKey = keyof (typeof STRINGS)["en"];

export function translate(lang: Lang, key: TKey): string {
  return STRINGS[lang][key] ?? STRINGS.en[key] ?? String(key);
}

/**
 * Tiny `{placeholder}` interpolation — no dependency. Replaces every
 * `{name}` token in `template` with the matching value from `vars`.
 */
export function interpolate(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (m, key) =>
    key in vars ? String(vars[key]) : m
  );
}

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved && LANGS.some((l) => l.code === saved)) return saved;
    }
    return detectLang();
  });

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang: setLangState, t: (key) => translate(lang, key) }),
    [lang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}
