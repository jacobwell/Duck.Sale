"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { browserDb } from "@/lib/supabase";
import {
  frameAt,
  newRecording,
  recordEvent,
  validateRecording,
  type Recording,
} from "@/lib/mega-replay";
import type { SearchEvent } from "@/lib/types";
import styles from "./mega-fleet.module.css";
const phases = [
  "queued",
  "starting",
  "searching",
  "extracting",
  "complete",
  "failed",
] as const;
const colors = {
  queued: "#76857d",
  starting: "#e5b95c",
  searching: "#65c6dc",
  extracting: "#b79ae9",
  complete: "#8bd4a1",
  failed: "#fb8276",
};
const labels = {
  queued: "At the dock",
  starting: "Warming up",
  searching: "At sea",
  extracting: "Sorting treasure",
  complete: "Returned",
  failed: "Failed",
};
function download(r: Recording) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(r)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `duck-sale-recording-${r.runId}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function vault(value?: Recording): Promise<Recording | null> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("duck-sale-mega", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("recordings");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("recordings", value ? "readwrite" : "readonly");
      const req = value
        ? tx.objectStore("recordings").put(value, "latest")
        : tx.objectStore("recordings").get("latest");
      tx.oncomplete = () => {
        db.close();
        resolve(value || req.result || null);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}
export function MegaFleet() {
  const [recording, setRecording] = useState<Recording | null>(null),
    [query, setQuery] = useState(
      "Find used boats for sale across the United States, including coastal cities and inland lakes.",
    ),
    [total, setTotal] = useState(1000),
    [speed, setSpeed] = useState(4),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [group, setGroup] = useState(0),
    [selected, setSelected] = useState(0),
    [capturing, setCapturing] = useState(false),
    [notice, setNotice] = useState(""),
    [progress, setProgress] = useState(""),
    [runId, setRunId] = useState(""),
    [faults, setFaults] = useState(false),
    [renderMs, setRenderMs] = useState(0);
  const controller = useRef<AbortController | null>(null),
    recordingRef = useRef<Recording | null>(null);
  useEffect(() => {
    vault()
      .then((r) => {
        if (r) setRecording(validateRecording(r));
      })
      .catch(() =>
        setNotice(
          "Browser storage unavailable. Import or download a recording to keep it.",
        ),
      );
    return () => controller.current?.abort();
  }, []);
  const duration = recording
    ? recording.durationMs + Math.ceil(total / 25) * 120
    : 1;
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now(),
        delta = now - last;
      last = now;
      setTime((t) => Math.min(duration, t + delta * speed));
    }, 200);
    return () => clearInterval(timer);
  }, [playing, speed, duration]);
  const fleet = useMemo(() => {
    const boats = recording
      ? Array.from({ length: total }, (_, i) => {
          const seed = recording.workers[i % recording.workers.length];
          const offset = Math.floor(i / 25) * 120;
          const frame = frameAt(seed.frames, time - offset);
          const injected =
            faults &&
            i % 20 === 0 &&
            time - offset > recording.durationMs * 0.55;
          return {
            id: i + 1,
            seed,
            frame: {
              ...frame,
              status: injected ? ("failed" as const) : frame.status,
            },
            injected,
          };
        })
      : [];
    return { boats };
  }, [recording, total, time, faults]);
  useEffect(() => {
    const start = performance.now();
    const id = requestAnimationFrame(() =>
      setRenderMs(performance.now() - start),
    );
    return () => cancelAnimationFrame(id);
  }, [time, total]);
  const counts = Object.fromEntries(
    phases.map((p) => [
      p,
      fleet.boats.filter((b) => b.frame.status === p).length,
    ]),
  );
  const groups = Array.from(
    { length: Math.ceil(fleet.boats.length / 25) },
    (_, i) => {
      const boats = fleet.boats.slice(i * 25, i * 25 + 25);
      return {
        boats,
        done: boats.filter((b) => b.frame.status === "complete").length,
        failed: boats.filter((b) => b.frame.status === "failed").length,
        active: boats.filter((b) =>
          ["starting", "searching", "extracting"].includes(b.frame.status),
        ).length,
      };
    },
  );
  const picked = fleet.boats[selected],
    visible = fleet.boats.slice(group * 25, group * 25 + 25);
  const callCount = fleet.boats.reduce(
    (sum, b) => sum + b.frame.calls.length,
    0,
  );
  async function accept(r: Recording) {
    setRecording(validateRecording(r));
    recordingRef.current = r;
    setTime(0);
    setPlaying(false);
    setGroup(0);
    setSelected(0);
    try {
      await vault(r);
    } catch {
      setNotice(
        "Loaded, but browser storage failed. Download the recording to preserve it.",
      );
    }
  }
  async function capture() {
    setNotice("");
    const session = (await browserDb()?.auth.getSession())?.data.session;
    if (!session) {
      setNotice("Sign in on the main page first, then return to this lab.");
      return;
    }
    setCapturing(true);
    setPlaying(false);
    setProgress("Launching 25 real seekers…");
    const r = newRecording(query);
    recordingRef.current = r;
    const started = performance.now();
    controller.current = new AbortController();
    let completed = false;
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          location: "United States",
          budget: null,
          intent: "buy",
          boatCount: 25,
        }),
        signal: controller.current.signal,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error("Search stream unavailable.");
      const reader = res.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "",
        lastSaved = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (!line.trim()) continue;
          const event = JSON.parse(line) as SearchEvent;
          recordEvent(r, event, performance.now() - started);
          if (event.type === "run") setRunId(event.id);
          if (event.type === "complete") completed = true;
          if (event.type === "error") setNotice(event.message);
        }
        setProgress(
          `${r.workers.length} seed seekers · ${r.workers.filter((w) => ["complete", "failed"].includes(w.frames.at(-1)!.status)).length} finished · ${r.listings.length} unique source links captured`,
        );
        if (r.workers.length && performance.now() - lastSaved > 2000) {
          lastSaved = performance.now();
          await vault(r).catch(() => {});
        }
      }
      if (!r.workers.length) throw new Error("No worker events were received.");
      await accept(r);
      setNotice(
        completed
          ? "Recording saved in this browser. Ready for simulated replay."
          : "Stream ended early. Partial recording preserved; check the real search for final results.",
      );
    } catch (e) {
      if (r.workers.length) await accept(r);
      setNotice(e instanceof Error ? e.message : "Recording failed.");
    } finally {
      setCapturing(false);
      controller.current = null;
    }
  }
  return (
    <main className={styles.lab}>
      <nav className={styles.nav}>
        <Link href="/">← Duck.Sale · normal search</Link>
        <span>EXPERIMENTAL / MEGA MODE / 101+</span>
      </nav>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>RELEASE THE QUACKEN</p>
          <h1>
            Little ducks.
            <br />
            Unreasonable fleet.
          </h1>
          <p>
            Record a real voyage. Replay its API events at ridiculous scale.
          </p>
        </div>
        <svg
          viewBox="0 0 180 150"
          width="180"
          aria-label="Captain duck aboard a boat"
        >
          <path d="M15 105h150l-30 32H42Z" fill="#e6b65c" />
          <path
            d="M90 16v88M95 23l52 72H95Z"
            fill="#f4edd7"
            stroke="#65c6dc"
            strokeWidth="3"
          />
          <path
            d="M40 99q-22-28 6-39q-6-30 17-25q20 5 8 23l17 8-23 7q15 24-25 26"
            fill="#f5d265"
          />
          <circle cx="61" cy="47" r="3" />
          <path d="M41 35l4-12 28 4-3 12Z" fill="#f5f1dc" />
          <path
            d="M10 143q20-10 40 0t40 0t40 0t40 0"
            fill="none"
            stroke="#65c6dc"
            strokeWidth="3"
          />
        </svg>
      </header>
      <div className={styles.banner}>
        SIMULATION LAB — 101–10,000 virtual boats. Repeated API events and
        results, not live provider requests or independent discoveries. Live
        searches remain capped at their existing limits.
      </div>
      <details className={styles.recordingPanel} open={!recording || capturing}>
        <summary>
          Recording & seed controls{" "}
          {recording
            ? `· ${recording.workers.length} real seekers captured${recording.completed ? "" : " · PARTIAL CAPTURE"}`
            : "· choose a seed to begin"}
        </summary>
        <section className={styles.setup} aria-label="Recording controls">
          <div>
            <h2>1. Bring the receipts</h2>
            <p>
              Record 25 real seekers using your account and provider credits.
              Only the public-search event stream is captured: worker states,
              API metadata, and listing outputs. No tokens, raw HTTP bodies, or
              private searches.
            </p>
            <label>
              Seed query
              <textarea
                maxLength={1000}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={capturing}
              />
            </label>
            <button
              disabled={capturing || query.trim().length < 5}
              onClick={capture}
            >
              {capturing
                ? "Recording live voyage…"
                : "Launch & record 25 real boats"}
            </button>
            {capturing && (
              <p role="status">
                {progress} · Keep this tab open. Leaving stops capture, not the
                server-owned search.
              </p>
            )}
            {runId && (
              <p>
                <Link href={`/search/${runId}`}>Open the real search ↗</Link>
              </p>
            )}
          </div>
          <div>
            <h2>Or load a recording</h2>
            <p>
              Replays make no search-provider calls. The latest recording is
              saved locally in this browser. Export it to move between devices.
            </p>
            <label className={styles.file}>
              Import JSON
              <input
                type="file"
                accept="application/json,.json"
                disabled={capturing}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > 20_000_000)
                      throw new Error("Recording must be under 20 MB.");
                    await accept(
                      validateRecording(JSON.parse(await file.text())),
                    );
                    setNotice("Recording loaded.");
                  } catch {
                    setNotice(
                      "Invalid recording. Use a Duck.Sale public-search recording under 20 MB.",
                    );
                  }
                  e.target.value = "";
                }}
              />
            </label>
            <button
              disabled={capturing}
              onClick={async () => {
                try {
                  const res = await fetch("/demo/mega-seed.json");
                  if (!res.ok) throw new Error();
                  await accept(validateRecording(await res.json()));
                  setNotice("Recorded seed loaded. No live searches launched.");
                } catch {
                  setNotice(
                    "No bundled seed available yet. Record or import a voyage.",
                  );
                }
              }}
            >
              Load recorded 25-boat seed
            </button>
            {recording && (
              <>
                <button
                  disabled={capturing}
                  onClick={() => download(recording)}
                >
                  Download recording
                </button>
                <p>
                  {recording.workers.length} recorded seekers ·{" "}
                  {recording.listings.length} unique source links ·{" "}
                  {new Date(recording.capturedAt).toLocaleString()}
                </p>
                <p>
                  <Link href={`/search/${recording.runId}`}>
                    Original search (owner sign-in required) ↗
                  </Link>
                </p>
              </>
            )}
          </div>
        </section>
      </details>
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      <section className={styles.controls}>
        <label>
          Virtual boats
          <select
            disabled={capturing}
            value={total}
            onChange={(e) => {
              setTotal(Number(e.target.value));
              setGroup(0);
              setSelected(0);
              setTime(0);
            }}
          >
            {[101, 250, 500, 1000, 2500, 10000].map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        <label>
          Replay speed
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            {[1, 4, 10, 25].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!recording || capturing}
          onClick={() => {
            if (time >= duration) setTime(0);
            setPlaying(!playing || time >= duration);
          }}
        >
          {playing && time < duration ? "Pause" : "Play simulation"}
        </button>
        <button
          disabled={!recording || capturing}
          onClick={() => {
            setTime(0);
            setPlaying(false);
          }}
        >
          Reset
        </button>
        <label>
          <input
            type="checkbox"
            checked={faults}
            onChange={(e) => setFaults(e.target.checked)}
          />{" "}
          Inject ~5% simulated failures
        </label>
      </section>
      <label className={styles.timeline}>
        Replay timeline · {Math.round(time / 1000)} /{" "}
        {Math.round(duration / 1000)}s
        <input
          aria-label="Replay timeline"
          type="range"
          min="0"
          max={duration}
          value={time}
          disabled={!recording || capturing}
          onChange={(e) => {
            setPlaying(false);
            setTime(Number(e.target.value));
          }}
        />
      </label>
      <section className={styles.metrics}>
        {phases.map((p) => (
          <div key={p} style={{ borderTopColor: colors[p] }}>
            <strong>{(counts[p] || 0).toLocaleString()}</strong>
            <span>{labels[p]}</span>
          </div>
        ))}
      </section>
      <p className={styles.telemetry}>
        {callCount.toLocaleString()} simulated call records exposed ·{" "}
        {recording?.listings.length || 0} unique recorded source links · last
        effect-to-frame {renderMs.toFixed(1)}ms (not a backend load test)
      </p>
      {!recording ? (
        <section className={styles.empty}>
          <h2>The ocean is suspiciously quiet.</h2>
          <p>
            Record or import a voyage to launch the simulation. No fabricated
            seed data.
          </p>
        </section>
      ) : (
        <>
          <section className={styles.ocean}>
            <div className={styles.sectionTitle}>
              <h2>2. Flotilla radar</h2>
              <span>
                {groups.length} groups · up to 25 boats each · click to inspect
              </span>
            </div>
            <div className={styles.grid}>
              {groups.map((g, i) => (
                <button
                  key={i}
                  className={group === i ? styles.selected : ""}
                  onClick={() => {
                    setGroup(i);
                    setSelected(i * 25);
                  }}
                  aria-pressed={group === i}
                  aria-label={`Flotilla ${i + 1}, ${g.boats.length} boats, ${g.active} active, ${g.done} returned, ${g.failed} failed`}
                >
                  <svg
                    className={g.active ? styles.sailing : undefined}
                    viewBox="0 0 60 40"
                    aria-hidden="true"
                  >
                    <path
                      d="M6 25h48L42 36H18Z M28 3v20H10Z M33 7v16h16Z"
                      fill={
                        g.failed
                          ? colors.failed
                          : g.active
                            ? colors.searching
                            : g.done
                              ? colors.complete
                              : colors.queued
                      }
                    />
                  </svg>
                  <strong>
                    {i * 25 + 1}–{Math.min(total, (i + 1) * 25)}
                  </strong>
                  <span>
                    {g.active} at sea · {g.done} home
                  </span>
                  <div className={styles.bar}>
                    {phases.map((p) => (
                      <i
                        key={p}
                        style={{
                          width: `${(100 * g.boats.filter((b) => b.frame.status === p).length) / g.boats.length}%`,
                          background: colors[p],
                        }}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </section>
          <section className={styles.detail}>
            <div>
              <h2>
                3. Dock {group + 1} / {groups.length}
              </h2>
              <p>Only this flotilla’s individual boats are rendered.</p>
              <div className={styles.berths}>
                {visible.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelected(b.id - 1)}
                    aria-pressed={selected === b.id - 1}
                    style={{
                      borderColor: colors[b.frame.status],
                      background: selected === b.id - 1 ? "#244a50" : undefined,
                    }}
                  >
                    <span style={{ color: colors[b.frame.status] }}>
                      ⛵ {b.id}
                    </span>
                    <small>{labels[b.frame.status]}</small>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h2>Ship-to-shore radio</h2>
              {picked && (
                <>
                  <p>
                    Virtual boat {picked.id} · seed {picked.seed.id}:{" "}
                    {picked.seed.name}
                  </p>
                  <p>
                    {labels[picked.frame.status]} · {picked.frame.finds}{" "}
                    repeated finds
                    {picked.injected
                      ? " · INJECTED FAILURE, not a provider error"
                      : ""}
                  </p>
                  <div className={styles.radio} role="log">
                    {picked.frame.calls.length ? (
                      picked.frame.calls
                        .slice(-20)
                        .reverse()
                        .map((c) => (
                          <article key={c.id}>
                            <strong>
                              {c.service} · {c.operation}
                            </strong>
                            <span>
                              {c.target || "Recorded API event"} ·{" "}
                              {c.statusCode || c.status} · replay
                            </span>
                          </article>
                        ))
                    ) : (
                      <p>
                        No recorded calls at this point in the seed timeline.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>
          <details className={styles.sources}>
            <summary>
              {recording.listings.length} original source links — never
              multiplied into “new finds”
            </summary>
            {recording.listings.slice(0, 100).map((l) => (
              <p key={l.sourceUrl}>
                <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {l.title} ↗
                </a>{" "}
                · {l.location || "Location unverified"} ·{" "}
                {l.price === null
                  ? "Price unverified"
                  : l.price.toLocaleString()}
              </p>
            ))}
          </details>
        </>
      )}
    </main>
  );
}
