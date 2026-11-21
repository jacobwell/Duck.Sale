"use client";
import { useMemo, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import atlas from "us-atlas/states-10m.json";
import type { Recording } from "@/lib/mega-replay";
import styles from "./mega-map.module.css";
const states = feature(
  atlas as unknown as Topology,
  atlas.objects.states as unknown as GeometryCollection,
);
const projection = geoAlbersUsa().fitExtent(
  [
    [170, 65],
    [945, 485],
  ],
  states,
);
const path = geoPath(projection);
const shapes = states.features.map((s) => ({
  id: String(s.id),
  path: path(s) || "",
}));
const harbor = [80, 445];
const colors = ["#eccc75", "#75d8df", "#b5a2ef", "#9bd5ad"];
function point(t: number, x: number, y: number, bend: number) {
  const u = 1 - t,
    cx = (harbor[0] + x) / 2,
    cy = Math.min(harbor[1], y) - bend;
  return [
    u * u * harbor[0] + 2 * u * t * cx + t * t * x,
    u * u * harbor[1] + 2 * u * t * cy + t * t * y,
  ];
}
export function MegaMap({
  recording,
  time,
  total,
  faults,
  onSelect,
}: {
  recording: Recording;
  time: number;
  total: number;
  faults: boolean;
  onSelect: (index: number) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const routes = useMemo(
    () =>
      recording.listings.flatMap((listing, i) => {
        if (!listing.locationPoint) return [];
        const p = projection([
          listing.locationPoint.longitude,
          listing.locationPoint.latitude,
        ]);
        if (!p) return [];
        const worker = recording.workers.findIndex(
          (w) => w.id === listing.workerId,
        );
        const frames = recording.workers[worker]?.frames;
        const arrival =
          listing.foundAt ??
          frames?.find((f) => f.finds > 0)?.at ??
          recording.durationMs;
        const depart = Math.max(
          frames?.find((f) => f.status === "searching")?.at ?? 0,
          arrival - 22000,
        );
        return [
          {
            listing,
            i,
            x: p[0],
            y: p[1],
            worker,
            arrival,
            depart,
            bend: 55 + (i % 5) * 23,
            color: colors[i % colors.length],
          },
        ];
      }),
    [recording],
  );
  const eligible = routes.filter(
    (r) =>
      !(
        faults &&
        r.worker >= 0 &&
        r.worker % 20 === 0 &&
        r.arrival > recording.durationMs * 0.55
      ),
  );
  const found = eligible.filter((r) => time >= r.arrival);
  // Screen-space bins keep nearby city pins readable without inventing coordinates.
  const bins = new Map<string, typeof found>();
  for (const r of found) {
    const key = `${Math.round(r.x / 28)},${Math.round(r.y / 28)}`;
    bins.set(key, [...(bins.get(key) || []), r]);
  }
  const active = eligible
    .filter((r) => time >= r.depart && time < r.arrival + 6000)
    .slice(-60);
  const picked = selected
    ? found.find((r) => r.listing.sourceUrl === selected)
    : null;
  const nearby = picked
    ? [...bins.values()].find((items) =>
        items.some((r) => r.listing.sourceUrl === selected),
      ) || [picked]
    : [];
  return (
    <section className={styles.panel} aria-label="Mega treasure map">
      <header>
        <div>
          <p>THE UNITED STATES OF WANTING STUFF</p>
          <h2>Treasure stays. Ducks sail on.</h2>
        </div>
        <span>
          {total.toLocaleString()} virtual boats · {found.length} mapped finds
          revealed
        </span>
      </header>
      <p className={styles.explain}>
        Representative voyages from the recorded seekers. Boats deliver a find,
        then fade with their wake. Treasure stays at its recorded city. Repeated
        virtual boats never create extra locations.
      </p>
      <div className={styles.ocean}>
        <svg
          viewBox="0 0 1000 550"
          role="group"
          aria-label={`United States treasure map: ${found.length} recorded finds revealed in ${bins.size} location clusters; ${active.length} visible voyages`}
        >
          <defs>
            <pattern
              id="mega-waves"
              width="65"
              height="45"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M5 25q10-8 20 0t20 0"
                stroke="#8bd6d9"
                strokeOpacity=".08"
                fill="none"
              />
            </pattern>
            <radialGradient id="mega-water">
              <stop stopColor="#265963" />
              <stop offset="1" stopColor="#102e38" />
            </radialGradient>
          </defs>
          <rect width="1000" height="550" rx="20" fill="url(#mega-water)" />
          <rect width="1000" height="550" fill="url(#mega-waves)" />
          {shapes.map((s) => (
            <path
              key={s.id}
              d={s.path}
              fill="#244949"
              stroke="#6c9290"
              strokeWidth=".7"
            />
          ))}
          <text x="28" y="45" fill="#91bec4" fontSize="11" letterSpacing="3">
            PACIFIC OF POSSIBILITIES
          </text>
          <text x="760" y="525" fill="#91bec4" fontSize="11" letterSpacing="2">
            SEA OF TOO MANY TABS
          </text>
          <circle
            cx={harbor[0]}
            cy={harbor[1]}
            r="23"
            fill="#183c43"
            stroke="#eccc75"
            strokeDasharray="3 4"
          />
          <text
            x={harbor[0]}
            y={harbor[1] + 7}
            textAnchor="middle"
            fill="#eccc75"
            fontSize="25"
          >
            ⚓
          </text>
          <text x="25" y="489" fill="#eccc75" fontSize="12">
            DUCK HARBOR
          </text>
          <text x="25" y="505" fill="#a9c6c8" fontSize="9">
            symbolic launch point
          </text>
          {active.map((r) => {
            const progress = Math.max(
                0,
                Math.min(
                  1,
                  (time - r.depart) / Math.max(1, r.arrival - r.depart),
                ),
              ),
              fade =
                time > r.arrival
                  ? Math.max(0, 1 - (time - r.arrival) / 6000)
                  : 1;
            const [x, y] = point(progress, r.x, r.y, r.bend);
            const cy = Math.min(harbor[1], r.y) - r.bend;
            return (
              <g key={r.listing.sourceUrl} opacity={fade}>
                <path
                  d={`M${harbor} Q${(harbor[0] + r.x) / 2},${cy} ${r.x},${r.y}`}
                  pathLength="1"
                  stroke={r.color}
                  strokeWidth="1.6"
                  strokeOpacity=".65"
                  strokeDasharray="1"
                  strokeDashoffset={1 - progress}
                  fill="none"
                />
                <g
                  transform={`translate(${x},${y - 9})`}
                  className={styles.boat}
                >
                  <title>
                    {r.listing.title} · recorded seeker{" "}
                    {r.listing.workerId || "unknown"}
                  </title>
                  <ellipse cy="16" rx="13" ry="3" fill="#051e2866" />
                  <path d="M-13 6h26l-6 9H-7Z" fill={r.color} />
                  <path d="M-1-17V5H-12Z" fill="#fff6db" />
                  <path d="M2-12V4h10Z" fill={r.color} />
                  <path d="M-1-20v26" stroke="#fff6db" strokeWidth="1.2" />
                </g>
              </g>
            );
          })}
          {[...bins.entries()].map(([key, items]) => {
            const r = items[0],
              x = items.reduce((s, v) => s + v.x, 0) / items.length,
              y = items.reduce((s, v) => s + v.y, 0) / items.length;
            return (
              <g
                key={key}
                transform={`translate(${x},${y})`}
                role="button"
                tabIndex={0}
                aria-label={`${items.length} recorded finds near ${r.listing.locationPoint?.label}. View treasure.`}
                onClick={() => {
                  setSelected(r.listing.sourceUrl);
                  if (r.worker >= 0) onSelect(r.worker);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(r.listing.sourceUrl);
                    if (r.worker >= 0) onSelect(r.worker);
                  }
                }}
                className={styles.treasure}
              >
                <title>{items.map((v) => v.listing.title).join("\n")}</title>
                <circle r="17" fill="#eccc7520" stroke="#eccc7570" />
                <path
                  d="M-10-2q0-13 20 0V9h-20Z"
                  fill="#d4a14f"
                  stroke="#fff1b2"
                  strokeWidth="1.4"
                />
                <path
                  d="M-10 0h20M-5-7V9M5-7V9"
                  stroke="#82562b"
                  strokeWidth="1.4"
                />
                <rect
                  x="-2"
                  y="-2"
                  width="4"
                  height="5"
                  rx="1"
                  fill="#fff4be"
                />
                {items.length > 1 && (
                  <>
                    <circle cx="12" cy="-12" r="9" fill="#fff1b2" />
                    <text
                      x="12"
                      y="-9"
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="bold"
                      fill="#17373b"
                    >
                      {items.length}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
        {!routes.length && (
          <div className={styles.empty}>
            This older recording has no city coordinates. Load the updated
            25-boat seed to see the map.
          </div>
        )}
      </div>
      <footer>
        <span>
          {active.length} visible voyages · {found.length} revealed /{" "}
          {routes.length} mappable finds ·{" "}
          {recording.listings.length - routes.length} unplaced or outside this
          map
        </span>
        <span>
          US Census / US Atlas · City-level pins · Illustrated search courses,
          not sailing routes
        </span>
      </footer>
      <div className={styles.receipt} aria-live="polite">
        {nearby.length ? (
          <>
            <h3>Treasure near {picked?.listing.locationPoint?.label}</h3>
            {nearby.map((r) => (
              <p key={r.listing.sourceUrl}>
                <a
                  href={r.listing.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {r.listing.title} ↗
                </a>
                <span>
                  Recorded seeker {r.listing.workerId || "unknown"} ·{" "}
                  {r.listing.location || "Location unverified"}
                </span>
              </p>
            ))}
          </>
        ) : (
          <p>
            Click a treasure chest to open its source and select the recorded
            seeker in the dock below.
          </p>
        )}
      </div>
    </section>
  );
}
