"use client";
/* eslint-disable @next/next/no-img-element -- Public DoorDash CDN photos, no server image proxy. */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Duck } from "@/components/duck";
import { browserDb } from "@/lib/supabase";
type Place = { id: number; label: string; latitude: number; longitude: number };
type Store = {
  kind: "restaurant" | "item";
  storeName: string | null;
  price: number | null;
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
  const [storeId, setStoreId] = useState("");
  const [coverage, setCoverage] = useState<{
    summary: string;
    receipts: string[];
  } | null>(null);
  const [mode, setMode] = useState<"restaurants" | "retail">("restaurants");
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
  async function locate(): Promise<Place | null> {
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
      if (d.places.length === 1) {
        setPlace(d.places[0]);
        setNotice(`Search area: ${d.places[0].label}`);
        return d.places[0];
      }
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
    return null;
  }
  async function search() {
    if (busy || finding || available !== true) return;
    if (query.trim().length < 2) {
      setNotice("Enter at least two characters to search.");
      return;
    }
    if (city.trim().length < 2) {
      setNotice("Enter a city to search nearby.");
      return;
    }
    const selectedPlace = place ?? (await locate());
    if (!selectedPlace) return;
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setSeconds(0);
    setSearchedPlace(selectedPlace.label);
    setStores(null);
    setCoverage(null);
    setNotice(
      mode === "retail"
        ? "Searching nearby retailers for matching items…"
        : "Asking DoorDash for restaurants near your selected city…",
    );
    try {
      const r = await fetch("/api/food/search", {
        method: "POST",
        headers: { ...(await auth()), "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          mode,
          ...(mode === "retail" && storeId.trim()
            ? { storeId: storeId.trim() }
            : {}),
          latitude: selectedPlace.latitude,
          longitude: selectedPlace.longitude,
        }),
        signal: c.signal,
      });
      const d = await r.json();
      if (c.signal.aborted) return;
      if (!r.ok) throw Error(d.error);
      setStores(d.stores);
      setCoverage(d.coverage ?? null);
      setNotice(
        d.stores.length
          ? "The duck found options. Open DoorDash to choose your delivery address and order yourself."
          : "No results returned for that search. Try a different item or check DoorDash directly.",
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
            <em>Snacks. Supplies. Sorted.</em>
          </h1>
          <p>
            Find food and retail items near your city. The duck scouts. You
            order on DoorDash.
          </p>
        </div>
        <div className="food-mascot" aria-hidden="true">
          <Duck size={100} />
          <span>🍕</span>
          <small>CAPTAIN OF TAKEOUT</small>
        </div>
      </section>
      <section className="food-search">
        <h2>Feed the crew. Stock the boat.</h2>
        <div className="food-modes" role="group" aria-label="Search type">
          {(["restaurants", "retail"] as const).map((value) => (
            <button
              key={value}
              type="button"
              disabled={busy}
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                setQuery(value === "retail" ? "AA batteries" : "pizza");
                setStores(null);
                setNotice("");
              }}
            >
              {value === "retail" ? "🛍️ Retail & groceries" : "🍕 Restaurants"}
            </button>
          ))}
        </div>
        <label htmlFor="food-query">
          {mode === "retail" ? "What do you need?" : "What sounds good?"}
        </label>
        <input
          id="food-query"
          value={query}
          maxLength={160}
          disabled={busy}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            mode === "retail"
              ? "Batteries, milk, dog treats, USB-C cable…"
              : "Pizza, ramen, tacos, a restaurant…"
          }
        />
        <div className="food-chips">
          {(mode === "retail"
            ? [
                "AA batteries",
                "USB-C cable",
                "Dog treats",
                "Milk",
                "Pokémon cards",
              ]
            : ["Pizza", "Ramen", "Tacos", "Burgers", "Coffee"]
          ).map((q) => (
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
        {mode === "retail" && (
          <div className="food-fine">
            <p>
              Searches 25 miles around your city. If matches are sparse, the
              duck checks additional store branches.
            </p>
            <label htmlFor="food-store">
              Specific DoorDash store ID (optional)
            </label>
            <input
              id="food-store"
              value={storeId}
              maxLength={20}
              inputMode="numeric"
              disabled={busy || finding}
              onChange={(e) => setStoreId(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 37130185 — search this branch directly"
            />
          </div>
        )}
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
          disabled={busy || finding || available !== true}
          onClick={() => void search()}
        >
          {finding
            ? "Finding your city…"
            : busy
              ? `The duck is scouting · ${seconds}s`
              : available === false
                ? "Food scout temporarily offline"
                : available === null
                  ? "Checking the galley…"
                  : mode === "retail"
                    ? "Find retail items ↗"
                    : "Find food with DoorDash ↗"}
        </button>
        {busy && (
          <div className="food-progress">
            <span aria-hidden="true">🦆</span>
            <p>
              {seconds > 20
                ? "DoorDash is taking a little longer. We’ll show its response when it arrives."
                : "Searching DoorDash. No cart is being created."}
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
          <p className="food-kicker">THE CREW MANIFEST</p>
          <h2 ref={results} tabIndex={-1}>
            {stores.length
              ? `${stores.length} ${stores[0]?.kind === "item" ? "items" : "places"}. Pick your next stop.`
              : "Nothing on the menu this time."}
          </h2>
          <p>
            {searchedPlace} · Distances are from the selected city point. Finish
            on DoorDash with your own account.
          </p>
          {coverage && (
            <details className="food-fine">
              <summary>
                Where the duck searched · {coverage.receipts.length} steps
              </summary>
              <p>{coverage.summary}</p>
              <ul>
                {coverage.receipts.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </details>
          )}
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
                    📦
                  </div>
                )}
                <div className="food-card-copy">
                  <h3>{s.name}</h3>
                  {s.kind === "item" && (
                    <>
                      <p>{s.storeName}</p>
                      <p>
                        {s.price !== null
                          ? `Listed price: ${s.price.toFixed(2)}`
                          : "Price not supplied"}
                      </p>
                      <small>
                        Confirm currency, stock and final price on DoorDash.
                      </small>
                    </>
                  )}
                  {s.kind === "restaurant" && (
                    <p>
                      {s.rating !== null
                        ? `★ ${s.rating}${s.reviewCount !== null ? ` (${s.reviewCount})` : ""}`
                        : "Rating not supplied"}
                      {s.distance ? ` · ${s.distance}` : ""}
                    </p>
                  )}
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
          Product and restaurant information comes from DoorDash. Retail search
          starts within 25 miles of the city point and can check additional
          branches. Up to 40 title-matched results; coverage is not exhaustive.
          Availability and prices can change.
        </p>
      </footer>
    </main>
  );
}
