"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Duck } from "./duck";
import { browserDb } from "@/lib/supabase";
import { pcSlots, type PcBuild } from "@/lib/pc-types";
const icons = ["◈", "▦", "▥", "▰", "▱", "ϟ", "▣", "❋"];
const working = (b: PcBuild | null) =>
  !!b && ["planning", "researching", "reviewing"].includes(b.status);
export function PcWorkspace() {
  const [budget, setBudget] = useState("1500"),
    [purpose, setPurpose] = useState(
      "1440p gaming, quiet enough for work, Wi-Fi, no RGB required",
    ),
    [location, setLocation] = useState("United States"),
    [build, setBuild] = useState<PcBuild | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [seconds, setSeconds] = useState(0);
  const result = useRef<HTMLDivElement>(null);
  async function auth() {
    const s = await browserDb()?.auth.getSession();
    if (!s?.data.session)
      throw Error("Sign in on the main page, then return to PC mode.");
    return { Authorization: `Bearer ${s.data.session.access_token}` };
  }
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const r = await fetch("/api/pc?id=" + encodeURIComponent(id!), {
          headers: await auth(),
          cache: "no-store",
        });
        const b = await r.json();
        if (!r.ok) throw Error(b.error);
        if (!stopped) {
          setBuild(b);
          setBusy(working(b));
          if (working(b)) timer = setTimeout(poll, 3000);
        }
      } catch (e) {
        if (!stopped)
          setError(e instanceof Error ? e.message : "Could not load build.");
      }
    }
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);
  async function start() {
    if (busy) return;
    setError("");
    setBusy(true);
    setSeconds(0);
    setBuild(null);
    let latest: PcBuild | null = null;
    try {
      const r = await fetch("/api/pc", {
        method: "POST",
        headers: { ...(await auth()), "Content-Type": "application/json" },
        body: JSON.stringify({ budget: Number(budget), purpose, location }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw Error(d.error);
      }
      if (!r.body) throw Error("Build stream unavailable");
      const reader = r.body.getReader(),
        decoder = new TextDecoder();
      let pending = "";
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        pending += decoder.decode(chunk.value, { stream: true });
        let i;
        while ((i = pending.indexOf("\n")) >= 0) {
          const line = pending.slice(0, i);
          pending = pending.slice(i + 1);
          if (!line.trim()) continue;
          latest = JSON.parse(line);
          setBuild(latest);
          window.history.replaceState(null, "", "/pc?id=" + latest!.id);
        }
      }
      if (!latest || working(latest))
        throw Error(
          "Connection ended while the build may still be running. Refresh this saved build URL to reconnect.",
        );
      result.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Build could not complete.");
    } finally {
      setBusy(false);
    }
  }
  function download() {
    if (!build?.plan) return;
    const text = [
      build.plan.name,
      build.input.purpose,
      `Budget: $${build.input.budget} USD; allocations are not live prices.`,
      ...build.plan.parts.map(
        (p) =>
          `${p.slot}: ${p.model} — target $${p.allocation}\n${build.sources
            .filter((s) => s.slot === p.slot)
            .map((s) => s.url)
            .join("\n")}`,
      ),
      ...(build.review?.checks.map(
        (c) => `${c.name}: ${c.status}\n${c.detail}`,
      ) || []),
      "Preliminary review only. Confirm exact revisions, fit, BIOS, connectors and final prices before buying.",
    ].join("\n\n");
    const u = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = u;
    a.download = "duck-sale-pc-parts.txt";
    a.click();
    URL.revokeObjectURL(u);
  }
  return (
    <main className="pc-page">
      <header className="food-nav">
        <Link href="/">
          <Duck size={32} /> Duck.Sale <span>/ silicon shipyard</span>
        </Link>
        <Link href="/">Back to the fleet ↗</Link>
      </header>
      <section className="pc-hero">
        <div>
          <p className="food-kicker">
            BONUS MODE · NY TOKEN EXCHANGE × CONTEXT.DEV
          </p>
          <h1>
            Some assembly.
            <br />
            <em>Questionable supervision.</em>
          </h1>
          <p>
            Eight parts. One hopefully very good PC. The duck plans, scouts
            sources, and checks whether the bits belong together.
          </p>
        </div>
        <svg
          viewBox="0 0 190 230"
          role="img"
          aria-label="A PC tower supervised by a captain duck"
        >
          <rect x="25" y="12" width="140" height="200" rx="18" fill="#244a3e" />
          <rect x="37" y="25" width="99" height="169" rx="9" fill="#d7e4cb" />
          <circle cx="86" cy="67" r="25" fill="#f2c457" />
          <path d="M65 67h42M86 46v42" stroke="#244a3e" strokeWidth="7" />
          <circle cx="86" cy="143" r="25" fill="#9eafdc" />
          <path d="M65 143h42M86 122v42" stroke="#244a3e" strokeWidth="7" />
          <circle cx="150" cy="36" r="4" fill="#f2c457" />
          <path d="M47 212v10m95-10v10" stroke="#244a3e" strokeWidth="8" />
          <text x="135" y="106" fontSize="36">
            🦆
          </text>
        </svg>
      </section>
      <div className="pc-steps">
        <span>01 · Plan the parts</span>
        <span>02 · Scout real sources</span>
        <span>03 · Check the fit</span>
      </div>
      <form
        className="pc-form"
        onSubmit={(e) => {
          e.preventDefault();
          void start();
        }}
      >
        <div>
          <label htmlFor="pc-budget">Tower budget · USD</label>
          <input
            id="pc-budget"
            type="number"
            min="500"
            max="20000"
            required
            value={budget}
            disabled={busy}
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="pc-location">Shopping location</label>
          <input
            id="pc-location"
            required
            minLength={2}
            maxLength={120}
            value={location}
            disabled={busy}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <div className="pc-brief">
          <label htmlFor="pc-purpose">What should this machine do?</label>
          <textarea
            id="pc-purpose"
            required
            minLength={5}
            maxLength={500}
            value={purpose}
            disabled={busy}
            onChange={(e) => setPurpose(e.target.value)}
          />
          <div className="food-chips">
            {[
              "1080p gaming and schoolwork",
              "1440p gaming, quiet and compact",
              "Local AI and coding; prioritize GPU VRAM",
            ].map((p) => (
              <button
                type="button"
                key={p}
                disabled={busy}
                onClick={() => setPurpose(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <button className="food-launch" disabled={busy}>
          {busy
            ? `The duck is assembling a theory · ${seconds}s`
            : "Plan & scout my PC ↗"}
        </button>
        <p className="food-fine">
          Budget excludes OS, peripherals, shipping and tax. NYTE handles
          inference; public model searches go to Context.dev. This is saved
          research, not Private Mode.{" "}
          <Link href="/">Sign in on the main page</Link>.
        </p>
      </form>
      {error && (
        <p role="alert" className="pc-notice">
          {error}
        </p>
      )}
      {build && (
        <section ref={result} className="pc-output">
          <p role="status" aria-live="polite" className="pc-notice">
            {busy ? "⚙ " : ""}
            {build.message}
          </p>
          {build.plan && (
            <>
              <div className="pc-heading">
                <div>
                  <p className="food-kicker">YOUR PROPOSED PARTS LIST</p>
                  <h2>{build.plan.name}</h2>
                  <p>{build.plan.summary}</p>
                </div>
                <button onClick={download}>Download parts list ↓</button>
              </div>
              <p className="food-fine">
                Allocation total: $
                {build.plan.parts
                  .reduce((n, p) => n + p.allocation, 0)
                  .toLocaleString()}{" "}
                / ${build.input.budget.toLocaleString()} budget.{" "}
                <strong>
                  These are spending targets, not verified prices.
                </strong>{" "}
                Sources may be listings, manufacturer specs or category pages;
                inspect the exact model and variant.
              </p>
              <div className="pc-parts">
                {pcSlots.map((slot, i) => {
                  const part = build.plan!.parts.find((p) => p.slot === slot)!;
                  const sources = build.sources.filter((s) => s.slot === slot);
                  return (
                    <article key={slot}>
                      <div className="pc-part-top">
                        <span aria-hidden="true">{icons[i]}</span>
                        <small>{slot}</small>
                        <strong>${part.allocation} target</strong>
                      </div>
                      <h3>{part.model}</h3>
                      <p>{part.reason}</p>
                      <details>
                        <summary>
                          {sources.length
                            ? `${sources.length} researched sources ↗`
                            : busy
                              ? "Research pending…"
                              : "No source evidence returned"}
                        </summary>
                        {sources.map((s) => (
                          <div className="pc-source" key={s.id}>
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {s.title} ↗
                            </a>
                            <p>{s.text}</p>
                          </div>
                        ))}
                      </details>
                      <Link
                        className="pc-fleet-link"
                        href={
                          "/?" +
                          new URLSearchParams({
                            q: part.model,
                            location: build.input.location,
                            budget: String(part.allocation),
                          })
                        }
                      >
                        Find exact offers with the fleet ↗
                      </Link>
                    </article>
                  );
                })}
              </div>
            </>
          )}
          {build.review && (
            <section className="pc-review">
              <p className="food-kicker">
                CURSORY COMPATIBILITY REVIEW · NOT A BUILD CERTIFICATION
              </p>
              <h2>Will it all fit together?</h2>
              <p>{build.review.summary}</p>
              <p className="food-fine">
                “Supported” means the quoted research supports the check. It
                does not verify your purchased revision or replace manufacturer
                specifications. Every “Verify” needs your attention.
              </p>
              {build.review.checks.map((c) => (
                <article key={c.name} className={"pc-check " + c.status}>
                  <div>
                    <span>
                      {c.status === "supported"
                        ? "Evidence supports"
                        : c.status === "conflict"
                          ? "Conflict found"
                          : "Verify before buying"}
                    </span>
                    <h3>{c.name}</h3>
                    <p>{c.detail}</p>
                  </div>
                  {c.evidence.length > 0 && (
                    <details>
                      <summary>Show evidence</summary>
                      {c.evidence.map((e, i) => {
                        const s = build.sources.find(
                          (s) => s.id === e.sourceId,
                        )!;
                        return (
                          <blockquote key={i}>
                            {e.quote}
                            <br />
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {s.title} ↗
                            </a>
                          </blockquote>
                        );
                      })}
                    </details>
                  )}
                </article>
              ))}
            </section>
          )}
        </section>
      )}
      <footer className="food-footer">
        <strong>Captain of compatibility. Still bring a screwdriver.</strong>
        <p>
          Source-backed research where available. Missing specs stay unverified.
          No purchases are made.
        </p>
      </footer>
    </main>
  );
}
