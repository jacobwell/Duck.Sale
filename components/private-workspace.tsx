"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Duck } from "@/components/duck";
import { SecretVoyageArt, PrivacyMark } from "@/components/private-art";
import { browserDb } from "@/lib/supabase";
type Status = {
  ready: boolean;
  services: { name: string; configured: boolean }[];
};
type Result = { title: string; reason: string; quote: string; url: string };
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
    [reply, setReply] = useState<Reply | null>(null),
    [notice, setNotice] = useState("");
  const abort = useRef<AbortController | null>(null);
  function scuttle() {
    abort.current?.abort();
    abort.current = null;
    setBrief("");
    setQuery("");
    setApproved(false);
    setReply(null);
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
  async function launch() {
    const session = await browserDb()?.auth.getSession();
    if (!session?.data.session) {
      setNotice("Sign in on the main page, then return to Private Mode.");
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setReply(null);
    setNotice(
      "Checking VPN, gathering public sources, then privately ranking. This may take a few minutes.",
    );
    try {
      const r = await fetch("/api/private/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.data.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ publicQuery: query, brief, approved }),
        signal: controller.signal,
        cache: "no-store",
      });
      const data = await r.json();
      if (!controller.signal.aborted) {
        setReply(data);
        setNotice(
          r.ok
            ? "Voyage returned. Inspect your privacy receipt below."
            : "The voyage stopped safely.",
        );
      }
    } catch {
      if (!controller.signal.aborted)
        setNotice(
          "Connection ended. Results were not saved. Worker deletion may still be pending.",
        );
    } finally {
      if (abort.current === controller) {
        abort.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <main className="secret-duck">
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
            Your business.
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
            <p>NYTE / TrustedRouter confidential inference.</p>
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
      <div className="secret-section-label">
        <span>YOUR DISCREET LITTLE SEARCH PARTY</span>
        <span>Public sources. Private preferences.</span>
      </div>
      <div className="secret-grid">
        <section className="secret-panel secret-form">
          <div className="secret-panel-heading">
            <PrivacyMark kind="query" />
            <div>
              <span>THE PUBLIC PART</span>
              <h2>What can leave the boat?</h2>
            </div>
          </div>
          <p>
            Only type terms you approve sharing with Boat and Context. Keep
            names, exact addresses, budgets and secrets out.
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
          <div className="secret-panel-heading secret-below">
            <PrivacyMark kind="brief" />
            <div>
              <span>THE PRIVATE PART</span>
              <h2>Keep the details below deck</h2>
            </div>
          </div>
          <label htmlFor="private-brief">Private ranking brief</label>
          <textarea
            id="private-brief"
            autoComplete="off"
            spellCheck={false}
            maxLength={6000}
            rows={6}
            value={brief}
            disabled={busy}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="My actual budget and private buying requirements…"
          />
          <p>
            The hosted Duck.Sale server receives this brief in memory and sends
            it to NYTE with confidential routing required. Boat and Context
            receive only the approved query. This is not browser-to-enclave
            encryption.
          </p>
          <button
            className="secret-launch"
            disabled={
              !config?.ready ||
              !approved ||
              query.length < 5 ||
              brief.length < 5 ||
              busy
            }
            onClick={launch}
          >
            {busy
              ? "Secret Duck is at sea…"
              : config?.ready
                ? "Send the secret duck ↗"
                : "Docked — services need setup"}
          </button>
          <p role="status" aria-live="polite">
            {notice}
          </p>
        </section>
        <aside className="secret-panel secret-manifest">
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
            Configured does not mean a live check. Each voyage verifies gateway
            attestation and checks the VPN exit before discovery; unsupported
            confidential inference fails closed.
          </p>
          <hr />
          <h3>What we keep</h3>
          <p>
            Account and timing metadata for rate limiting. No brief, approved
            query, source content, or AI result is written to Duck.Sale’s search
            history.
          </p>
          <h3>What can still be seen</h3>
          <p>
            Infrastructure operators can access server memory. Context sees your
            public query and requested pages. Network and provider metadata may
            remain. The VPN protects worker egress only; Context’s own crawlers
            use its network.
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
        </aside>
      </div>
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
