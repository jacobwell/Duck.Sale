"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PrivateVoyage } from "@/components/private-voyage";
import type { PrivateActivity, PrivateEvent } from "@/lib/private-events";
import { Duck } from "@/components/duck";
import { SecretVoyageArt, PrivacyMark } from "@/components/private-art";
import { browserDb } from "@/lib/supabase";
type Status = {
  ready: boolean;
  services: { name: string; configured: boolean }[];
};
type Result = {
  title: string;
  reason: string;
  quote: string;
  url: string;
  price: string | null;
  location: string | null;
  availability: string | null;
};
type Reply = {
  results?: Result[];
  error?: string;
  partial?: boolean;
  routing?: string;
  model?: string;
  attestation?: { binding: string; imageDigest: string; expiresAt: number };
  receipt?: {
    publicQuery?: string;
    vpnExit: string | null;
    sandboxDeleted: boolean;
    contentSaved: boolean;
    admissionMetadataRetained: boolean;
  };
};
export function PrivateWorkspace() {
  const [config, setConfig] = useState<Status | null>(null),
    [query, setQuery] = useState(""),
    [brief, setBrief] = useState(""),
    [approved, setApproved] = useState(false),
    [busy, setBusy] = useState(false),
    [preparing, setPreparing] = useState(false),
    [prepared, setPrepared] = useState<Reply | null>(null),
    [reply, setReply] = useState<Reply | null>(null),
    [notice, setNotice] = useState("");
  const [activities, setActivities] = useState<PrivateActivity[]>([]);
  const [voyageMode, setVoyageMode] = useState<"prepare" | "search">("search");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [pulseAt, setPulseAt] = useState<number | null>(null);
  const [voyageFailed, setVoyageFailed] = useState(false);
  const tracker = useRef<HTMLDivElement | null>(null);
  const abort = useRef<AbortController | null>(null);
  function scuttle() {
    abort.current?.abort();
    abort.current = null;
    setActivities([]);
    setStartedAt(null);
    setFinishedAt(null);
    setPulseAt(null);
    setVoyageFailed(false);
    setBrief("");
    setQuery("");
    setApproved(false);
    setReply(null);
    setPrepared(null);
    setPreparing(false);
    setBusy(false);
    setNotice(
      "Voyage cleared from this page. Server cleanup may still be finishing; provider copies and backups are not proven erased.",
    );
  }
  useEffect(() => {
    fetch("/api/private/search", { cache: "no-store" })
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setNotice("Service setup could not be loaded."));
    const clear = () => {
      abort.current?.abort();
      abort.current = null;
      setPrepared(null);
      setPreparing(false);
      setNotice("");
      setActivities([]);
      setStartedAt(null);
      setFinishedAt(null);
      setPulseAt(null);
      setVoyageFailed(false);
      setBrief("");
      setQuery("");
      setReply(null);
      setApproved(false);
      setBusy(false);
    };
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) clear();
    };
    window.addEventListener("pageshow", restored);
    window.addEventListener("pagehide", clear);
    const timer = setTimeout(clear, 15 * 60 * 1000);
    return () => {
      window.removeEventListener("pagehide", clear);
      window.removeEventListener("pageshow", restored);
      clearTimeout(timer);
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!busy && prepared && voyageMode === "prepare") {
      document.getElementById("public-query")?.focus();
    }
  }, [busy, prepared, voyageMode]);
  async function run(action: "prepare" | "search") {
    if (abort.current || (action === "search" && !approved)) return;
    const controller = new AbortController();
    abort.current = controller;
    setActivities([]);
    setStartedAt(Date.now());
    setFinishedAt(null);
    setPulseAt(null);
    setVoyageFailed(false);
    setVoyageMode(action);
    if (action === "search")
      tracker.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    setBusy(true);
    setPreparing(action === "prepare");
    setReply(null);
    if (action === "prepare") {
      setApproved(false);
      setPrepared(null);
    }
    setNotice(
      action === "prepare"
        ? "NYTE is drafting a public query. Nothing goes to Boat or Context until you approve and send it."
        : "Checking VPN, gathering public sources, then confidentially extracting and ranking with NYTE. This may take a few minutes.",
    );
    try {
      const session = await browserDb()?.auth.getSession();
      if (controller.signal.aborted) return;
      if (!session?.data.session) {
        setVoyageFailed(true);
        setNotice("Sign in on the main page, then return to Private Mode.");
        return;
      }
      const r = await fetch(
        `/api/private/${action === "prepare" ? "prepare" : "search"}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.data.session.access_token}`,
            "Content-Type": "application/json",
            Accept: "application/x-ndjson",
          },
          body: JSON.stringify(
            action === "prepare"
              ? { brief }
              : { publicQuery: query, brief, approved },
          ),
          signal: controller.signal,
          cache: "no-store",
        },
      );
      let data: Reply & { publicQuery?: string };
      let ok = r.ok;
      if (
        r.headers.get("content-type")?.includes("application/x-ndjson") &&
        r.body
      ) {
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "",
          resultSeen = false;
        let finalData: (Reply & { publicQuery?: string }) | undefined;
        const consume = (line: string) => {
          if (!line.trim() || controller.signal.aborted) return;
          const event = JSON.parse(line) as PrivateEvent;
          setPulseAt(Date.now());
          if (event.type === "activity")
            setActivities((previous) => {
              const old = previous.find((a) => a.id === event.id);
              return [
                ...previous.filter((a) => a.id !== event.id),
                { ...event, startedAt: old?.startedAt || event.startedAt },
              ].slice(-100);
            });
          if (event.type === "result") {
            finalData = event.body;
            ok = event.status >= 200 && event.status < 300;
            resultSeen = true;
          }
        };
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            if (buffer.length > 1_000_000)
              throw new Error("Stream exceeded limit");
            let newline;
            while ((newline = buffer.indexOf("\n")) >= 0) {
              consume(buffer.slice(0, newline));
              buffer = buffer.slice(newline + 1);
            }
          }
          buffer += decoder.decode();
          if (buffer.trim()) consume(buffer);
        } finally {
          reader.releaseLock();
        }
        if (!resultSeen || !finalData)
          throw new Error("Stream ended before result");
        data = finalData;
      } else data = await r.json();
      if (controller.signal.aborted) return;
      setVoyageFailed(!ok);
      if (action === "prepare") {
        if (ok && data.publicQuery) {
          setQuery(data.publicQuery);
          setPrepared(data);
          setNotice(
            "Draft ready. Review and edit every word, then approve it below. No discovery has started.",
          );
        } else setNotice(data.error || "Query preparation could not complete.");
      } else {
        setReply(data);
        setNotice(
          ok
            ? "Voyage returned. Inspect your privacy receipt below."
            : "The voyage stopped safely.",
        );
      }
    } catch {
      if (!controller.signal.aborted) {
        setVoyageFailed(true);
        setNotice(
          action === "prepare"
            ? "Preparation connection ended. Nothing was sent to discovery. You can retry or write your own public query."
            : "Connection ended. Results were not saved. Worker deletion may still be pending.",
        );
      }
    } finally {
      if (abort.current === controller) {
        abort.current = null;
        setBusy(false);
        setFinishedAt(Date.now());
        setPreparing(false);
      }
    }
  }
  return (
    <main className="secret-duck secret-task-first">
      <header>
        <Link href="/" className="secret-brand">
          <Duck size={30} /> Duck.Sale<span> / </span>
          <small>after hours</small>
        </Link>
        <span className="secret-nav-note">PRIVATE MODE · EARLY VOYAGE</span>
        <button onClick={scuttle}>
          Clear this voyage <span aria-hidden="true">↗</span>
        </button>
      </header>
      <section className="secret-hero">
        <div className="secret-hero-copy">
          <p className="secret-eyebrow">
            <span /> LOOSE BEAKS SINK SHIPS
          </p>
          <h1>
            Your business.{" "}
            <br />
            Our very <em>quiet</em> ducks.
          </h1>
          <p className="secret-intro">
            Same questionable purchases. A little more discretion.
          </p>
          <p className="secret-hero-detail">
            You approve what goes to search. Your private preferences take the
            confidential route.
          </p>
          <div className="secret-partners">
            <span>BOAT.DEV</span>
            <b>×</b>
            <span>CONTEXT.DEV</span>
            <b>×</b>
            <span>NY TOKEN EXCHANGE</span>
          </div>
        </div>
        <div className="secret-illustration">
          <SecretVoyageArt />
          <p>
            CAPTAIN INCOGNITO <span>Unlicensed. Now in sunglasses.</span>
          </p>
        </div>
      </section>
      <div className="secret-grid">
        <section className="secret-panel secret-form">
          <div className="secret-panel-heading">
            <PrivacyMark kind="brief" />
            <div>
              <span>START HERE · 01 / THE PRIVATE PART</span>
              <h2>Keep the details below deck</h2>
            </div>
          </div>
          <label htmlFor="private-brief">Private shopping brief</label>
          <textarea
            id="private-brief"
            autoComplete="off"
            spellCheck={false}
            maxLength={6000}
            rows={6}
            value={brief}
            disabled={busy}
            onChange={(e) => {
              setBrief(e.target.value);
              setApproved(false);
              setPrepared(null);
              setReply(null);
            }}
            placeholder="My actual budget and private buying requirements…"
          />
          <details className="secret-explainer">
            <summary>Who can see my brief?</summary>
            <p>
              The hosted Duck.Sale server receives this brief in memory and
              sends it to NYTE for query preparation and ranking, with
              confidential routing required. Boat and Context receive only the
              approved query. This is not browser-to-enclave encryption.
            </p>
          </details>
          <button
            className="secret-prepare"
            disabled={
              !config?.services.find(
                (s) => s.name === "NYTE confidential route",
              )?.configured ||
              brief.trim().length < 5 ||
              busy
            }
            onClick={() => run("prepare")}
          >
            {preparing
              ? "NYTE is drafting…"
              : "Let NYTE draft the public query ↗"}
          </button>
          <p>Draft it with NYTE, or write your public query below.</p>
          {prepared?.attestation && (
            <details className="secret-preparation-receipt">
              <summary>NYTE draft receipt · discovery not started</summary>
              <p>
                Model: {prepared.model}. Gateway binding:{" "}
                {prepared.attestation.binding}. Brief and draft not saved;
                account/timing metadata retained.
              </p>
              <p style={{ overflowWrap: "anywhere" }}>
                Verified image: {prepared.attestation.imageDigest}
              </p>
            </details>
          )}
          <div className="secret-panel-heading">
            <PrivacyMark kind="query" />
            <div>
              <span>02 / THE PUBLIC PART</span>
              <h2>What can leave the boat?</h2>
            </div>
          </div>
          <p>
            Review the NYTE draft or write your own query. AI can miss sensitive
            details: keep names, exact addresses, budgets and secrets out. Only
            the exact text you approve goes to Boat and Context.
          </p>
          <label htmlFor="public-query">Public search query</label>
          <input
            id="public-query"
            autoComplete="off"
            spellCheck={false}
            maxLength={400}
            value={query}
            disabled={busy}
            onChange={(e) => {
              setQuery(e.target.value);
              setApproved(false);
              setPrepared(null);
              setReply(null);
            }}
            placeholder="DGX Spark 128 GB for sale US"
          />
          <label className="secret-check">
            <input
              type="checkbox"
              checked={approved}
              disabled={busy}
              onChange={(e) => setApproved(e.target.checked)}
            />{" "}
            I approve sending exactly this query to discovery providers.
          </label>
          <button
            className="secret-launch"
            disabled={
              !config?.ready ||
              !approved ||
              query.length < 5 ||
              brief.length < 5 ||
              busy
            }
            onClick={() => run("search")}
          >
            {busy
              ? preparing
                ? "Prepare, review, then sail…"
                : "Secret Duck is at sea…"
              : config?.ready
                ? "Send the secret duck ↗"
                : "Docked — services need setup"}
          </button>
          <p role="status" aria-live="polite">
            {notice}
          </p>
        </section>
        <aside className="secret-panel secret-manifest">
          <h2>Your discreet little search party</h2>
          <ol className="secret-flow">
            <li>Write your private requirements.</li>
            <li>Review the public query. You decide what leaves.</li>
            <li>Approve, launch, then follow the live voyage below.</li>
          </ol>
          <details>
            <summary>Privacy, services &amp; what we keep</summary>
            <div className="secret-panel-heading">
              <PrivacyMark kind="wake" />
              <div>
                <span>CHECK THE MANIFEST</span>
                <h2>Discreet. Not invisible.</h2>
              </div>
            </div>
            <ul>
              {config?.services.map((s) => (
                <li key={s.name}>
                  <span className={s.configured ? "secret-configured" : ""}>
                    {s.configured ? "✓ Configured" : "○ Missing"}
                  </span>
                  <span>{s.name}</span>
                </li>
              ))}
            </ul>
            <p>
              Configured does not mean a live check. Each NYTE call verifies
              gateway attestation; the VPN exit is checked before discovery.
              Unsupported confidential inference fails closed.
            </p>
            <hr />
            <h3>What we keep</h3>
            <p>
              Account and timing metadata for rate limiting. No brief, draft,
              approved query, source content, or AI result is written to
              Duck.Sale’s search history.
            </p>
            <h3>What can still be seen</h3>
            <p>
              Infrastructure operators can access server memory. Context sees
              your public query and requested pages. Network and provider
              metadata may remain. The VPN protects worker egress only;
              Context’s own crawlers use its network.
            </p>
            <h3>Ephemeral by default</h3>
            <p>
              Page content clears on departure or after 15 minutes. No private
              content is put in browser storage. Scuttle clears the page and
              requests cancellation; it cannot prove erasure from RAM,
              infrastructure logs or backups.
            </p>
            <p>
              Photos do not load automatically. Opening a source exposes your
              browser to that site.
            </p>
          </details>
        </aside>
      </div>
      <div ref={tracker} className="private-tracker-anchor">
        {startedAt ? (
          <PrivateVoyage
            activities={activities}
            busy={busy}
            preparing={voyageMode === "prepare"}
            startedAt={startedAt}
            finishedAt={finishedAt}
            pulseAt={pulseAt}
            failed={voyageFailed}
            onCancel={scuttle}
            model={voyageMode === "prepare" ? prepared?.model : reply?.model}
          />
        ) : (
          <div className="pv-standby">
            <span aria-hidden="true">◈</span>
            <div>
              <b>Captain Incognito’s live voyage bridge</b>
              <p>
                Launch a draft or a search to follow the duck, inspect real API
                calls, and watch the privacy checks.
              </p>
            </div>
            <small>RADIO ON STANDBY</small>
          </div>
        )}
        {startedAt && (
          <p className="pv-action-notice" role="status">
            {notice}
          </p>
        )}
      </div>
      <section
        className="secret-route"
        aria-label="How Private Mode handles your search"
      >
        <div>
          <PrivacyMark kind="query" />
          <div>
            <span>01 / ABOVE DECK</span>
            <h2>A query you approve</h2>
            <p>Boat + Context discover public sources.</p>
          </div>
        </div>
        <div>
          <PrivacyMark kind="brief" />
          <div>
            <span>02 / BELOW DECK</span>
            <h2>Your reasons stay separate</h2>
            <p>NYTE drafts queries, extracts facts, and ranks finds.</p>
          </div>
        </div>
        <div>
          <PrivacyMark kind="wake" />
          <div>
            <span>03 / NO SAVED SEARCH</span>
            <h2>A temporary voyage</h2>
            <p>VPN worker traffic. Search content not saved.</p>
          </div>
        </div>
      </section>
      {reply && (
        <section className="secret-panel">
          <h2>
            {reply.error ? "Voyage report" : "The confidential shortlist"}
          </h2>
          {reply.error && <p role="alert">{reply.error}</p>}
          {reply.partial && (
            <p>Partial source coverage; these results are not exhaustive.</p>
          )}
          {reply.results?.length === 0 && (
            <p>No source-supported matches. Nothing was invented.</p>
          )}
          {reply.results?.map((r, i) => (
            <article className="secret-result" key={i}>
              <h3>{r.title}</h3>
              <dl className="secret-facts">
                <div>
                  <dt>Price</dt>
                  <dd>{r.price || "Not stated in source"}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{r.location || "Not stated in source"}</dd>
                </div>
                <div>
                  <dt>Availability</dt>
                  <dd>{r.availability || "Not stated in source"}</dd>
                </div>
              </dl>
              <p>{r.reason}</p>
              <blockquote>{r.quote}</blockquote>
              <a
                href={/^https:\/\//.test(r.url) ? r.url : undefined}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
              >
                Open original source ↗
              </a>
            </article>
          ))}
          {reply.receipt && (
            <div>
              <h3>Privacy receipt</h3>
              <p>
                VPN exit checked: {reply.receipt.vpnExit || "not confirmed"}.
                Worker deletion:{" "}
                {reply.receipt.sandboxDeleted
                  ? "API reports completed"
                  : "not confirmed; deletion may be pending or TTL fallback may stop it"}
                .
              </p>
              <p>
                No search content saved by Duck.Sale. Admission metadata
                retained. Third-party erasure not verified.
              </p>
              <p>{reply.routing}</p>
              {reply.attestation && (
                <details>
                  <summary>Inspect gateway verification</summary>
                  <p>
                    Model: {reply.model}. Binding: {reply.attestation.binding}.
                  </p>
                  <p style={{ overflowWrap: "anywhere" }}>
                    Verified image: {reply.attestation.imageDigest}
                  </p>
                  <p>
                    The published release policy and a fresh Google-signed
                    attestation were checked before the prompt was sent over the
                    same TLS connection. Upstream confidentiality is enforced by
                    NYTE.
                  </p>
                </details>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
