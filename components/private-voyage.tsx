"use client";
import { useEffect, useState } from "react";
import type { PrivateActivity } from "@/lib/private-events";
type Props = {
  activities: PrivateActivity[];
  busy: boolean;
  preparing: boolean;
  startedAt: number | null;
  finishedAt: number | null;
  pulseAt: number | null;
  failed: boolean;
  onCancel: () => void;
  model?: string;
};
const seconds = (ms: number) => `${Math.max(0, Math.floor(ms / 1000))}s`;
export function PrivateVoyage({
  activities,
  busy,
  preparing,
  startedAt,
  finishedAt,
  pulseAt,
  failed,
  onCancel,
  model,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  const elapsed = startedAt ? seconds((finishedAt || now) - startedAt) : "—";
  const running = activities.filter((a) => a.status === "running").at(-1);
  const lastChange = activities.at(-1)?.at;
  const slow = busy && lastChange && now - Date.parse(lastChange) > 30000;
  const stale = busy && pulseAt && now - pulseAt > 20000;
  const sources = activities.find((a) => a.id === "sources")?.count;
  const finds = activities.find((a) => a.id === "results")?.count;
  const calls = activities.filter(
    (a) =>
      a.service === "Context.dev" && a.id !== "sources" && a.id !== "queue",
  );
  const vpn = activities.find((a) => a.id === "vpn")?.status === "complete";
  const verified =
    activities.find((a) => a.id === "attestation")?.status === "complete";
  const cleaned = activities.find((a) => a.id === "cleanup")?.status;
  const title = !startedAt
    ? "Your secret duck is on standby."
    : failed
      ? "Rough seas. Here’s the receipt."
      : !busy
        ? preparing
          ? "Draft docked. Your approval next."
          : "Back with receipts."
        : running?.operation || "Connecting to the harbor…";
  const stages = preparing
    ? [
        { id: "attestation", name: "Verify gateway" },
        { id: "inference", name: "Draft privately" },
        { id: "review", name: "Your review" },
      ]
    : [
        { id: "worker", name: "Launch worker" },
        { id: "vpn", name: "Check VPN" },
        { id: "sources", name: "Gather sources" },
        { id: "cleanup", name: "Delete worker" },
        { id: "inference", name: "NYTE ranking" },
        { id: "results", name: "Your shortlist" },
      ];
  const progressIndex = stages.reduce(
    (n, s, i) => (activities.some((a) => a.id === s.id) ? i : n),
    0,
  );
  return (
    <section
      className={`private-voyage ${busy ? "is-sailing" : ""}`}
      aria-label="Live private voyage tracker"
    >
      <div className="pv-heading">
        <div>
          <span className="pv-eyebrow">CAPTAIN INCOGNITO’S BRIDGE</span>
          <h2>{title}</h2>
        </div>
        <span className={`pv-live ${busy ? "active" : ""}`}>
          {busy
            ? "LIVE VOYAGE"
            : startedAt
              ? "VOYAGE REPORT"
              : "READY WHEN YOU ARE"}
        </span>
      </div>
      <div className="pv-sea" aria-hidden="true">
        <svg viewBox="0 0 1000 230" role="img">
          <defs>
            <pattern
              id="private-sea-grid"
              width="50"
              height="50"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M50 0H0V50"
                fill="none"
                stroke="currentColor"
                strokeWidth=".5"
                opacity=".14"
              />
            </pattern>
          </defs>
          <rect width="1000" height="230" fill="url(#private-sea-grid)" />
          <circle cx="890" cy="45" r="23" fill="#ecdb9a" />
          <circle cx="901" cy="37" r="23" fill="#153b35" />
          <path
            className="pv-wake"
            d="M70 170Q150 90 245 150T430 135T620 145T820 115L935 145"
            fill="none"
            stroke="#bcd9bd"
            strokeWidth="2"
            strokeDasharray="6 9"
          />
          <path
            className="pv-wave"
            d="M0 205Q50 180 100 205T200 205T300 205T400 205T500 205T600 205T700 205T800 205T900 205T1000 205"
            fill="none"
            stroke="#6f9a87"
            opacity=".6"
          />
          {[90, 260, 435, 610, 780, 930].map((x, i) => (
            <g key={x}>
              <circle
                cx={x}
                cy={160 - (i % 2) * 28}
                r="7"
                fill={startedAt && i <= progressIndex ? "#e9c963" : "#31564b"}
              />
            </g>
          ))}
          <g
            style={{
              transform: `translate(${startedAt ? 80 + progressIndex * (preparing ? 340 : 165) : 80}px, 90px)`,
              transition: "transform 1.8s ease-in-out",
            }}
          >
            <g className="pv-boat">
              <path d="M-38 44H42L25 61H-21Z" fill="#dfbd76" />
              <path d="M0 38V-20L31 34Z" fill="#e9ebca" />
              <path d="M-5 35V-11L-29 35Z" fill="#a6cbb5" />
              <path d="M0-20H24L17-8H0Z" fill="#edc64f" />
              <circle cx="-15" cy="32" r="9" fill="#eac653" />
              <path d="M-23 28H-6V33H-23Z" fill="#18382f" />
              <path d="M-6 32L2 36H-6Z" fill="#e99a49" />
            </g>
          </g>
          <text x="30" y="30" fill="#b8cdbb" fontSize="12" letterSpacing="3">
            THE SEA OF DISCRETION
          </text>
          <text x="790" y="210" fill="#b8cdbb" fontSize="11">
            LOOSE BEAKS SINK SHIPS
          </text>
        </svg>
        <p>
          Stage illustration · movement is decorative, not a location or
          completion estimate.
        </p>
      </div>
      <div className="pv-stats">
        <div>
          <span>Elapsed</span>
          <strong>{elapsed}</strong>
        </div>
        <div>
          <span>Context calls</span>
          <strong>{calls.length}</strong>
        </div>
        <div>
          <span>Sources returned</span>
          <strong>{sources ?? "—"}</strong>
        </div>
        <div>
          <span>Supported finds</span>
          <strong>{finds ?? "—"}</strong>
        </div>
      </div>
      <ol className="pv-stages">
        {stages.map((s) => {
          const event = activities.find((a) => a.id === s.id);
          const status = event?.status || "pending";
          return (
            <li key={s.id} className={status}>
              <b>
                {status === "complete"
                  ? "✓"
                  : status === "failed"
                    ? "!"
                    : status === "running" && busy
                      ? "◌"
                      : "·"}
              </b>
              <span>{s.name}</span>
              <small>
                {status === "running" && !busy ? "unconfirmed" : status}
              </small>
            </li>
          );
        })}
      </ol>
      <div className="pv-bottom">
        <p role="status" aria-live="polite">
          {stale
            ? "Connection quiet for over 20 seconds. Completion is not confirmed."
            : slow
              ? "Still waiting on the provider. The connection is alive; there is no reliable ETA."
              : busy
                ? preparing
                  ? "NYTE is preparing your draft. No discovery is running."
                  : "Real worker events below. Busy seas can take a few minutes."
                : startedAt
                  ? "Activity stays on this page and clears with the voyage."
                  : "A real activity feed will appear when you prepare a query or send the duck."}
        </p>
        {busy && <button onClick={onCancel}>Stop & clear voyage ↗</button>}
      </div>
      <div className="pv-seals">
        <span className={vpn ? "verified" : ""}>
          ◈ VPN{" "}
          {vpn
            ? "verified"
            : preparing
              ? "not used for draft"
              : "not yet verified"}
        </span>
        <span className={verified ? "verified" : ""}>
          ✧ Gateway {verified ? "verified" : "not yet verified"}
        </span>
        <span className={cleaned === "complete" ? "verified" : ""}>
          ⚓ Worker{" "}
          {cleaned === "complete"
            ? "deleted"
            : cleaned === "failed"
              ? "deletion unconfirmed"
              : preparing
                ? "not launched"
                : "deletion pending"}
        </span>
      </div>
      <p className="pv-model">
        Confidential route: <b>nyte/confidential</b> ·{" "}
        {model
          ? `Served by ${model}`
          : "The actual model is reported when NYTE responds."}
      </p>
      <div className="pv-radio">
        <div className="pv-radio-title">
          <div>
            <span className="pv-eyebrow">ENCRYPTED SHIP-TO-SHORE RADIO</span>
            <h3>Quiet ducks. Visible work.</h3>
          </div>
          <span>
            {pulseAt
              ? busy
                ? `Last server pulse ${seconds(now - pulseAt)} ago`
                : "Response received · connection closed"
              : "Awaiting connection"}
          </span>
        </div>
        <p className="pv-radio-note">
          Service, operation, timing, and status only. No brief, query text,
          page contents, or credentials. Kept in page memory.
        </p>
        {!activities.length ? (
          <div className="pv-empty">
            📡 Radio check. The captain is polishing his sunglasses.
          </div>
        ) : (
          <ul>
            {(expanded ? activities : activities.slice(-8))
              .slice()
              .reverse()
              .map((a) => (
                <li key={a.id}>
                  <span className={`pv-call-icon ${a.status}`}>
                    {a.status === "complete"
                      ? "✓"
                      : a.status === "failed"
                        ? "!"
                        : busy
                          ? "◌"
                          : "·"}
                  </span>
                  <div>
                    <b>{a.service}</b>
                    <span>
                      {a.operation}
                      {a.count !== undefined ? ` · ${a.count}` : ""}
                    </span>
                  </div>
                  <small>
                    {a.httpStatus ? `HTTP ${a.httpStatus} · ` : ""}
                    {a.finishedAt
                      ? seconds(
                          Date.parse(a.finishedAt) - Date.parse(a.startedAt),
                        )
                      : busy
                        ? seconds(now - Date.parse(a.startedAt))
                        : "unconfirmed"}
                    <em>
                      {a.status === "running" && !busy
                        ? "ended without confirmation"
                        : a.status}
                    </em>
                  </small>
                </li>
              ))}
          </ul>
        )}
        {activities.length > 8 && (
          <button className="pv-expand" onClick={() => setExpanded(!expanded)}>
            {expanded
              ? "Show recent calls"
              : `Show all ${activities.length} activities`}
          </button>
        )}
      </div>
    </section>
  );
}
