import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./map.css";
import type { Store } from "../lib/types";
import { useI18n } from "../lib/i18n";

// ---------------------------------------------------------------------------
// Local i18n label map (all 5 langs + en fallback) — mirrors the DELIVER
// pattern in BasketPanel.tsx. We DO NOT edit src/lib/i18n.tsx.
// ---------------------------------------------------------------------------
interface MapLabels {
  locating: string; // while geolocation is resolving
  picked: string; // "{name} picked — your nearest store" ({n} placeholder)
  denied: string; // geolocation unavailable/denied → tap a store
  use: string; // "Use this store"
  closest: string; // badge on the nearest card
}

const LABELS: Record<string, MapLabels> = {
  en: {
    locating: "Finding your nearest store…",
    picked: "{n} — your nearest store",
    denied: "Tap a store on the map or list to pick one",
    use: "Use this store",
    closest: "Closest",
  },
  ua: {
    locating: "Шукаємо найближчий магазин…",
    picked: "{n} — ваш найближчий магазин",
    denied: "Торкніться магазину на карті або у списку",
    use: "Обрати цей магазин",
    closest: "Найближчий",
  },
  ru: {
    locating: "Ищем ближайший магазин…",
    picked: "{n} — ваш ближайший магазин",
    denied: "Нажмите на магазин на карте или в списке",
    use: "Выбрать этот магазин",
    closest: "Ближайший",
  },
  hu: {
    locating: "Megkeressük a legközelebbi üzletet…",
    picked: "{n} — a legközelebbi üzleted",
    denied: "Koppints egy üzletre a térképen vagy a listában",
    use: "Ezt az üzletet választom",
    closest: "Legközelebbi",
  },
  es: {
    locating: "Buscando tu tienda más cercana…",
    picked: "{n} — tu tienda más cercana",
    denied: "Toca una tienda en el mapa o la lista",
    use: "Usar esta tienda",
    closest: "Más cercana",
  },
};

// Haversine distance in km between two lat/lng points.
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function hasCoords(s: Store): s is Store & { lat: number; lng: number } {
  return typeof s.lat === "number" && typeof s.lng === "number";
}

interface StoreMapProps {
  stores: Store[];
  /** Programmatic send used to pick a store (same shape as the old chips). */
  onPick: (text: string) => void;
  disabled?: boolean;
}

export default function StoreMap({ stores, onPick, disabled }: StoreMapProps) {
  const { lang } = useI18n();
  const labels = LABELS[lang] ?? LABELS.en;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  // Guard so the auto-pick fires exactly once even under StrictMode double-invoke.
  const pickedRef = useRef(false);

  const [nearestId, setNearestId] = useState<number | null>(null);
  const [status, setStatus] = useState<"locating" | "picked" | "manual">("locating");

  const located = stores.filter(hasCoords);

  // Build the icons (kept stable; divIcon avoids the bundler default-marker bug).
  function pinIcon(nearest: boolean): L.DivIcon {
    return L.divIcon({
      className: "sm-pin-wrap",
      html: `<div class="sm-pin ${nearest ? "sm-pin--nearest" : ""}"><span>📍</span></div>`,
      iconSize: nearest ? [40, 40] : [30, 30],
      iconAnchor: nearest ? [20, 38] : [15, 28],
      popupAnchor: [0, nearest ? -36 : -26],
    });
  }

  // ----- Map lifecycle: create once, clean up on unmount -----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Markers for every located store.
    const bounds: L.LatLngTuple[] = [];
    located.forEach((s) => {
      const marker = L.marker([s.lat, s.lng], { icon: pinIcon(false) }).addTo(map);
      const safeName = String(s.name);
      const meta = [s.city, s.address].filter(Boolean).join(" · ");
      const popup = L.DomUtil.create("div", "sm-popup");
      const nameEl = L.DomUtil.create("div", "sm-popup__name", popup);
      nameEl.textContent = safeName;
      if (meta) {
        const addrEl = L.DomUtil.create("div", "sm-popup__addr", popup);
        addrEl.textContent = meta;
      }
      const btn = L.DomUtil.create("button", "sm-popup__btn", popup) as HTMLButtonElement;
      btn.type = "button";
      btn.textContent = labels.use;
      btn.disabled = !!disabled;
      L.DomEvent.on(btn, "click", () => {
        if (disabled) return;
        onPick(`Use store ${safeName}`);
      });
      marker.bindPopup(popup);
      markersRef.current.set(s.id, marker);
      bounds.push([s.lat, s.lng]);
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [36, 36] });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 13);
    } else {
      map.setView([48.2, 14.0], 4); // central-Europe fallback view
    }

    // ----- Geolocation + auto-pick -----
    if (located.length && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          let best = located[0];
          let bestD = Infinity;
          for (const s of located) {
            const d = haversineKm(latitude, longitude, s.lat, s.lng);
            if (d < bestD) {
              bestD = d;
              best = s;
            }
          }
          setNearestId(best.id);

          // Upgrade the nearest marker's icon.
          const m = markersRef.current.get(best.id);
          if (m) m.setIcon(pinIcon(true));

          // "You are here" marker.
          L.marker([latitude, longitude], {
            icon: L.divIcon({
              className: "sm-you-wrap",
              html: '<div class="sm-pin sm-pin--you"></div>',
              iconSize: [18, 18],
              iconAnchor: [9, 9],
            }),
            interactive: false,
            keyboard: false,
          }).addTo(map);

          // Frame user + nearest store.
          map.fitBounds(
            [
              [latitude, longitude],
              [best.lat, best.lng],
            ],
            { padding: [50, 50], maxZoom: 13 },
          );

          // Auto-pick EXACTLY ONCE.
          if (!pickedRef.current && !disabled) {
            pickedRef.current = true;
            setStatus("picked");
            onPick(`Use store ${String(best.name)}`);
          } else {
            setStatus("picked");
          }
        },
        () => {
          // Denied / unavailable / errored → no auto-pick, manual fallback.
          setStatus("manual");
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
      );
    } else {
      setStatus("manual");
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
    // Create the map once for this set of stores. `stores` is a stable artifact.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCardPick(s: Store) {
    if (disabled) return;
    const m = markersRef.current.get(s.id);
    if (m && mapRef.current && hasCoords(s)) {
      mapRef.current.setView([s.lat, s.lng], 13);
      m.openPopup();
    }
    onPick(`Use store ${String(s.name)}`);
  }

  const statusText =
    status === "locating"
      ? labels.locating
      : status === "picked"
        ? labels.picked.replace(
            "{n}",
            String(stores.find((s) => s.id === nearestId)?.name ?? ""),
          )
        : labels.denied;

  return (
    <div className="storemap">
      <div
        ref={containerRef}
        className="storemap__canvas"
        role="img"
        aria-label="Map of ALDI stores"
      />

      <div
        className={`storemap__status ${status === "picked" ? "storemap__status--ok" : ""}`}
        aria-live="polite"
      >
        {status === "picked" ? "✅ " : status === "locating" ? "📍 " : "👆 "}
        {statusText}
      </div>

      <ul className="storemap__list">
        {stores.map((s) => {
          const isNearest = s.id === nearestId;
          return (
            <li key={s.id}>
              <button
                type="button"
                className={`storemap__card ${isNearest ? "storemap__card--nearest" : ""}`}
                onClick={() => handleCardPick(s)}
                disabled={disabled}
                aria-label={`${labels.use}: ${String(s.name)}`}
              >
                <span className="storemap__card-pin" aria-hidden="true">
                  📍
                </span>
                <span className="storemap__card-body">
                  <span className="storemap__card-name">{String(s.name)}</span>
                  {s.city ? (
                    <span className="storemap__card-city">{String(s.city)}</span>
                  ) : null}
                </span>
                {isNearest ? (
                  <span className="storemap__badge">{labels.closest}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
