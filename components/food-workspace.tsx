"use client";
/* eslint-disable @next/next/no-img-element -- Public DoorDash CDN photos, no server image proxy. */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Duck } from "@/components/duck";
import { browserDb } from "@/lib/supabase";
type Place = { id: number; label: string; latitude: number; longitude: number };
type Store = {
  id: string;
  name: string;
  image: string | null;
  distance: string | null;
  rating: number | null;
  reviewCount: number | null;
  pickup: boolean | null;
  url: string;
};
export function FoodWorkspace() {
  const [query, setQuery] = useState("pizza"),
    [city, setCity] = useState("San Francisco"),
    [places, setPlaces] = useState<Place[]>([]),
    [place, setPlace] = useState<Place | null>(null),
    [searchedPlace, setSearchedPlace] = useState(""),
    [stores, setStores] = useState<Store[] | null>(null),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [finding, setFinding] = useState(false),
    [available, setAvailable] = useState<boolean | null>(null),
    [seconds, setSeconds] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const results = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    fetch("/api/food/search", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAvailable(d.available === true))
      .catch(() => setAvailable(false));
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  useEffect(() => {
    if (stores && !busy) {
      results.current?.focus({ preventScroll: true });
      results.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    }
  }, [stores, busy]);
  async function auth() {
    const s = await browserDb()?.auth.getSession();
    if (!s?.data.session)
      throw Error("Sign in on the main page, then come back for snacks.");
    return { Authorization: `Bearer ${s.data.session.access_token}` };
  }
  async function locate() {
    setFinding(true);
    setNotice("");
    setPlaces([]);
    setPlace(null);
    try {
      const r = await fetch(
        "/api/food/locations?q=" + encodeURIComponent(city),
        { headers: await auth(), signal: AbortSignal.timeout(12000) },
      );
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setPlaces(d.places);
      setNotice(
        d.places.length
          ? "Choose the city below."
          : "No matching city found. Try a nearby city name.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "City lookup failed.");
    } finally {
      setFinding(false);
    }
  }
  async function search() {
    if (!place || busy) return;
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setSeconds(0);
    setSearchedPlace(place.label);
    setStores(null);
    setNotice("Asking DoorDash for restaurants near your selected city…");
    try {
      const r = await fetch("/api/food/search", {
        method: "POST",
        headers: { ...(await auth()), "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          latitude: place.latitude,
          longitude: place.longitude,
        }),
        signal: c.signal,
      });
      const d = await r.json();
      if (c.signal.aborted) return;
      if (!r.ok) throw Error(d.error);
      setStores(d.stores);
      setNotice(
        d.stores.length
          ? "The duck found food. Open DoorDash to choose your delivery address and order yourself."
          : "No restaurants returned for that search. Try a different food or check DoorDash directly.",
      );
    } catch (e) {
      if (!c.signal.aborted)
        setNotice(
          e instanceof Error ? e.message : "Search interrupted. Try again.",
        );
    } finally {
      if (controller.current === c) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <main className="food-page">
      <header className="food-nav">
        <Link href="/">
          <Duck size={30} /> Duck.Sale <span>/ crew provisions</span>
        </Link>
        <Link href="/">Back to the fleet ↗</Link>
      </header>
      <section className="food-hero">
        <div>
          <p className="food-kicker">BONUS VOYAGE · POWERED BY DOORDASH</p>
          <h1>
            Questionable purchases.
            <br />
            <em>Excellent snack breaks.</em>
          </h1>
          <p>
            Find food near your city. The duck scouts. You order on DoorDash.
          </p>
        </div>
        <div className="food-mascot" aria-hidden="true">
          <Duck size={100} />
          <span>🍕</span>
          <small>CAPTAIN OF TAKEOUT</small>
        </div>
      </section>
      <section className="food-search">
        <h2>Feed the crew.</h2>
        <label htmlFor="food-query">What sounds good?</label>
        <input
          id="food-query"
          value={query}
          maxLength={160}
          disabled={busy}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pizza, ramen, tacos, a restaurant…"
        />
        <div className="food-chips">
          {["Pizza", "Ramen", "Tacos", "Burgers", "Coffee"].map((q) => (
            <button
              key={q}
              type="button"
              disabled={busy}
              onClick={() => setQuery(q)}
            >
              {q}
            </button>
          ))}
        </div>
        <label htmlFor="food-city">City to search</label>
        <div className="food-location">
          <input
            id="food-city"
            value={city}
            maxLength={100}
            disabled={busy || finding}
            onChange={(e) => {
              setCity(e.target.value);
              setPlace(null);
              setPlaces([]);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !finding && city.trim().length >= 2)
                void locate();
            }}
          />
          <button
            disabled={busy || finding || city.trim().length < 2}
            onClick={() => void locate()}
          >
            {finding ? "Finding city…" : "Find city ↗"}
          </button>
        </div>
        {places.length > 0 && (
          <fieldset className="food-places">
            <legend>Choose your search area</legend>
            {places.map((p) => (
              <label key={p.id}>
                <input
                  type="radio"
                  name="food-place"
                  disabled={busy}
                  checked={place?.id === p.id}
                  onChange={() => setPlace(p)}
                />
                {p.label}
              </label>
            ))}
          </fieldset>
        )}
        <p className="food-fine">
          City-level discovery, not a delivery quote. Your query and selected
          city coordinates go to DoorDash. Set your exact address and check
          prices, hours and delivery availability there.
        </p>
        <button
          className="food-launch"
          disabled={
            busy || available !== true || !place || query.trim().length < 2
          }
          onClick={() => void search()}
        >
          {busy
            ? `The duck is scouting · ${seconds}s`
            : available === false
              ? "Food scout temporarily offline"
              : available === null
                ? "Checking the galley…"
                : "Find food with DoorDash ↗"}
        </button>
        {busy && (
          <div className="food-progress">
            <span aria-hidden="true">🦆</span>
            <p>
              {seconds > 20
                ? "DoorDash is taking a little longer. We’ll show its response when it arrives."
                : "Searching real restaurants. No cart is being created."}
            </p>
            <button
              onClick={() => {
                controller.current?.abort();
                controller.current = null;
                setBusy(false);
                setNotice("Search cancelled.");
              }}
            >
              Cancel
            </button>
          </div>
        )}
        <p role="status" aria-live="polite">
          {notice}
        </p>
        <p className="food-fine">
          Need to sign in?{" "}
          <Link href="/">Use your Duck.Sale login on the main page.</Link>
        </p>
      </section>
      {stores && (
        <section className="food-results">
          <p className="food-kicker">THE GALLEY MANIFEST</p>
          <h2 ref={results} tabIndex={-1}>
            {stores.length
              ? `${stores.length} places. One hungry crew.`
              : "Nothing on the menu this time."}
          </h2>
          <p>
            {searchedPlace} · Distances are from the selected city point. Finish
            on DoorDash with your own account.
          </p>
          <div className="food-cards">
            {stores.map((s) => (
              <article key={s.id}>
                {s.image ? (
                  <img
                    src={s.image}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="food-photo-empty" aria-hidden="true">
                    🍽️
                  </div>
                )}
                <div className="food-card-copy">
                  <h3>{s.name}</h3>
                  <p>
                    {s.rating !== null
                      ? `★ ${s.rating}${s.reviewCount !== null ? ` (${s.reviewCount})` : ""}`
                      : "Rating not supplied"}
                    {s.distance ? ` · ${s.distance}` : ""}
                  </p>
                  {s.pickup === true && (
                    <small>Pickup offered · confirm on DoorDash</small>
                  )}
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                  >
                    View on DoorDash ↗
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      <footer className="food-footer">
        <strong>Discovery only. Your appetite, your checkout.</strong>
        <p>
          Duck.Sale cannot place orders, create carts or charge you. Account
          addresses, payments, orders and promotions are not exposed by this
          feature.
        </p>
        <a
          href="https://www.doordash.com/"
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
        >
          Continue on DoorDash ↗
        </a>
        <p>
          Restaurant photos and information come from DoorDash. Availability and
          prices can change.
        </p>
      </footer>
    </main>
  );
}
