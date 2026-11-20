"use client";
import { useRef, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import atlas from "us-atlas/states-10m.json";
import {
  Compass,
  Play,
  Radio,
  Pause,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { priceLabel, type SearchRun, type Listing } from "@/lib/types";
const states = feature(
  atlas as unknown as Topology,
  atlas.objects.states as unknown as GeometryCollection,
);
const projection = geoAlbersUsa().fitExtent(
  [
    [175, 65],
    [785, 405],
  ],
  states,
);
const path = geoPath(projection);
const stateShapes = states.features.map((s) => ({
  id: String(s.id),
  path: path(s) || "",
}));
const colors = ["#f4be59", "#77bba6", "#e58e77", "#79a9d6"];
const names = ["Captain Quack", "Duck Norris", "The Quackup Plan", "Dash Duck"];
const destinations: [number, number][] = [
  [138, 150],
  [815, 230],
  [480, 455],
  [820, 390],
];
const port: [number, number] = [94, 380];
function Boat({ color }: { color: string }) {
  return (
    <g className="map-boat-bob">
      <ellipse cy="18" rx="23" ry="5" fill="#244d5022" />
      <path
        d="M-25 8h49L12 24h-24Z"
        fill={color}
        stroke="#355958"
        strokeWidth="1.5"
      />
      <path d="M-2-33V8" stroke="#355958" strokeWidth="2" />
      <path d="M-6-29-24 3h18Z" fill="#fffef3" />
      <path d="m3-22 15 25H3Z" fill={color} />
      <path d="M-2-33h14l-4 6H-2Z" fill="#fff8dc" />
    </g>
  );
}
function Treasure() {
  return (
    <svg width="32" height="30" viewBox="0 0 32 30" aria-hidden="true">
      <path
        d="M4 13C4 2 28 2 28 13v13H4Z"
        fill="#b98545"
        stroke="#5a563b"
        strokeWidth="1.5"
      />
      <path d="M4 14h24M10 6v20M22 6v20" stroke="#f6d56e" strokeWidth="3" />
      <rect x="13" y="12" width="6" height="7" rx="1" fill="#ffe48c" />
      <path d="m27 1 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" fill="#fff8cb" />
    </svg>
  );
}
export function FleetMap({
  run,
  busy,
  onSelect,
  onSample,
  demoPaused,
  onToggleDemo,
  onShowAll,
}: {
  run: SearchRun | null;
  busy: boolean;
  onSelect: (item: Listing) => void;
  onSample: () => void;
  demoPaused: boolean;
  onToggleDemo: () => void;
  onShowAll: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const preview = Boolean(run?.recorded);
  const workers = run?.workers || [];
  const items = run?.listings || [];
  const playing = preview && run?.status === "running";
  const points = items.flatMap((item) => {
    const p = item.locationPoint;
    if (!p) return [];
    const xy = projection([p.longitude, p.latitude]);
    return xy ? [{ item, xy }] : [];
  });
  const groups = points.reduce<{ xy: [number, number]; items: Listing[] }[]>(
    (all, p) => {
      const group = all.find(
        (g) =>
          Math.abs(g.xy[0] - p.xy[0]) < 8 && Math.abs(g.xy[1] - p.xy[1]) < 8,
      );
      if (group) group.items.push(p.item);
      else all.push({ xy: p.xy as [number, number], items: [p.item] });
      return all;
    },
    [],
  );
  const unplaced = items.filter((l) => !points.some((p) => p.item.id === l.id));
  const calls = workers
    .flatMap((w) => (w.calls || []).map((c) => ({ ...c, workerId: w.id })))
    .filter((c) => !selectedWorker || c.workerId === selectedWorker)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const active = workers.filter(
    (w) => w.sandboxId && !w.cleanup && w.status !== "failed",
  ).length;
  const status = preview
    ? "RECORDED DEMO · NO LIVE CALLS"
    : busy
      ? "LIVE EXPEDITION"
      : run?.sample
        ? "FICTIONAL SAMPLE"
        : run?.status === "partial"
          ? "PARTIAL RESULTS"
          : run
            ? "VOYAGE REPORT"
            : "ALL DUCKS ON DECK";
  return (
    <section
      className={`ocean-panel ${preview ? "is-preview" : ""}`}
      aria-label="Live boat search map"
    >
      <div className="ocean-heading">
        <div>
          <span className="eyebrow">
            <Radio size={12} />
            {status}
          </span>
          <h2>The internet is a big pond.</h2>
        </div>
        <div className="ocean-actions">
          {!busy && (
            <button onClick={onSample}>
              <Play size={13} />
              {preview ? "Replay voyage" : "Watch 20-boat voyage"}
            </button>
          )}
          {playing && (
            <>
              <button onClick={onToggleDemo}>
                {demoPaused ? <Play size={13} /> : <Pause size={13} />}
                {demoPaused ? "Resume" : "Pause"}
              </button>
              <button onClick={onShowAll}>Show all 20</button>
            </>
          )}
          <span>
            {preview
              ? `${items.length} / 20 treasures${playing && demoPaused ? " · paused" : ""}`
              : `${active} active · ${items.length} finds`}
          </span>
        </div>
      </div>
      {preview && (
        <div
          className="voyage-progress"
          aria-label={`${items.length} of 20 recorded boats revealed`}
        >
          <div style={{ width: `${items.length * 5}%` }} />
          <p>
            {items.length === 20
              ? "20 boats aboard. Financial responsibility overboard."
              : demoPaused
                ? "Anchors down. Your treasure can wait."
                : "Two coasts. Three lake stops. Absolutely no sense of restraint."}{" "}
            <span>Source snapshots · animated discovery</span>
          </p>
        </div>
      )}
      <div className="ocean-canvas">
        <div className="chart-tools">
          <button
            aria-label="Zoom in on the map"
            onClick={() => setZoom((z) => Math.min(4, z * 1.5))}
          >
            +
          </button>
          <button
            aria-label="Zoom out on the map"
            onClick={() => setZoom((z) => Math.max(1, z / 1.5))}
          >
            −
          </button>
          <button
            aria-label="Reset map view"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            ↺
          </button>
          <span>drag to explore</span>
        </div>
        <svg
          className="sea-chart"
          viewBox={`${450 - 450 / zoom + pan.x} ${255 - 255 / zoom + pan.y} ${900 / zoom} ${510 / zoom}`}
          onPointerDown={(e) => {
            if ((e.target as Element).closest('[role="button"]')) return;
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              panX: pan.x,
              panY: pan.y,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const factor =
              900 / e.currentTarget.getBoundingClientRect().width / zoom;
            setPan({
              x: Math.max(
                -600,
                Math.min(
                  600,
                  drag.current.panX - (e.clientX - drag.current.x) * factor,
                ),
              ),
              y: Math.max(
                -300,
                Math.min(
                  300,
                  drag.current.panY - (e.clientY - drag.current.y) * factor,
                ),
              ),
            });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          role="group"
          aria-label="US coastline with search boats and approximate city locations of results"
        >
          <defs>
            <pattern
              id="sea-lines"
              width="70"
              height="45"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M-10 24q17-8 35 0t35 0 35 0"
                fill="none"
                stroke="#f6fff6"
                strokeWidth="1"
                opacity=".38"
              />
            </pattern>
            <pattern
              id="land-grain"
              width="12"
              height="12"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="4" r=".6" fill="#a6b18c" opacity=".4" />
            </pattern>
          </defs>
          <rect width="900" height="510" fill="#afcdc6" />
          <rect
            className="ocean-waves"
            x="-70"
            width="1040"
            height="510"
            fill="url(#sea-lines)"
          />
          <g className="map-land">
            {stateShapes.map((s) => (
              <path
                key={s.id}
                d={s.path}
                fill="#e9e8ca"
                stroke="#c0c7a6"
                strokeWidth=".65"
              />
            ))}
            {stateShapes.map((s) => (
              <path key={"grain" + s.id} d={s.path} fill="url(#land-grain)" />
            ))}
          </g>
          <text x="500" y="255" textAnchor="middle" className="map-country">
            UNITED STATES OF WANTING STUFF
          </text>
          <text
            x="66"
            y="253"
            className="sea-label"
            transform="rotate(-90 66 253)"
          >
            PACIFIC OF POSSIBILITIES
          </text>
          <text
            x="781"
            y="360"
            className="sea-label"
            transform="rotate(-62 781 360)"
          >
            SEA OF TOO MANY TABS
          </text>
          <g transform="translate(818 68)" className="chart-compass">
            <circle r="27" fill="none" stroke="#638a80" opacity=".4" />
            <path d="M0-23 5 0 0 23-5 0Z" fill="#658d80" />
            <path d="M-23 0 0-5 23 0 0 5Z" fill="#eff5dd" />
            <text y="-34" textAnchor="middle">
              N
            </text>
          </g>
          <g transform={`translate(${port.join(" ")})`}>
            <circle
              r="29"
              fill="#f8f1cb"
              stroke="#718f73"
              strokeDasharray="3 4"
            />
            <text y="5" textAnchor="middle" fontSize="25">
              ⚓
            </text>
            <text y="48" textAnchor="middle" className="port-label">
              DUCK HARBOR
            </text>
            <text y="60" textAnchor="middle" className="port-subtitle">
              search origin · not a location
            </text>
          </g>
          {names
            .slice(0, workers.some((w) => w.id === "4") ? 4 : 3)
            .map((name, i) => {
              const w = workers.find((w) => w.id === String(i + 1));
              const phase = w?.status || "queued";
              const found = [...points]
                .reverse()
                .find((p) => p.item.workerId === w?.id);
              const target = found
                ? [found.xy[0] - 30, found.xy[1] - 35]
                : destinations[i];
              const isMoving =
                !(preview && demoPaused) &&
                ["starting", "searching", "extracting"].includes(phase);
              const afloat = phase !== "queued";
              const position =
                phase === "queued"
                  ? [100 + i * 115, 440]
                  : phase === "starting"
                    ? [port[0] + 35 + i * 25, port[1] - 45 - i * 15]
                    : target;
              const route = `M ${port[0]} ${port[1]} Q ${port[0] + (target[0] - port[0]) * 0.25} ${Math.min(port[1], target[1]) - 80 - i * 20} ${target[0]} ${target[1]}`;
              return (
                <g
                  key={name}
                  opacity={
                    selectedWorker && selectedWorker !== String(i + 1)
                      ? 0.35
                      : 1
                  }
                >
                  {afloat && (
                    <path
                      d={route}
                      className={`boat-route ${isMoving ? "traveling" : ""}`}
                      fill="none"
                      stroke={colors[i]}
                      strokeWidth="2.5"
                      strokeDasharray="5 7"
                    />
                  )}
                  {afloat && isMoving && (
                    <circle
                      cx={target[0]}
                      cy={target[1]}
                      r="29"
                      className="sonar-ring"
                      fill="none"
                      stroke={colors[i]}
                      strokeWidth="2"
                    />
                  )}
                  <g
                    className={`chart-boat ${isMoving ? "working" : ""}`}
                    style={{
                      transform: `translate(${position[0]}px,${position[1]}px)`,
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${name}: ${phase}. Show ${preview ? "recorded discoveries" : "API calls"}`}
                    onClick={() =>
                      setSelectedWorker(
                        selectedWorker === String(i + 1) ? null : String(i + 1),
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedWorker(String(i + 1));
                      }
                    }}
                  >
                    <title>{`${name} · ${phase}${w?.sandboxId ? ` · ${w.sandboxId}` : ""}`}</title>
                    <Boat color={colors[i]} />
                    <text y="42" textAnchor="middle" className="boat-name">
                      {name}
                    </text>
                    <text y="55" textAnchor="middle" className="boat-phase">
                      {preview ? "demo · " : ""}
                      {phase === "queued"
                        ? "in port"
                        : phase === "complete"
                          ? "back with receipts"
                          : phase === "failed"
                            ? "hit rough seas"
                            : phase}
                    </text>
                  </g>
                </g>
              );
            })}
          {groups.map((g, i) => (
            <g
              key={i}
              className="treasure-pin"
              transform={`translate(${g.xy[0]} ${g.xy[1]})`}
              role="button"
              tabIndex={0}
              aria-label={`Open treasure: ${g.items.map((l) => l.title).join(", ")}`}
              onClick={() => onSelect(g.items[0])}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(g.items[0]);
                }
              }}
            >
              <title>{`${g.items[0].locationPoint?.label} · ${g.items.length} ${g.items.length === 1 ? "find" : "finds"} · click to inspect`}</title>
              <circle r="21" fill="#fff6cb" fillOpacity=".8" />
              <g transform="translate(-16 -21)">
                <Treasure />
              </g>
              <text y="26" textAnchor="middle" className="treasure-count">
                {g.items.length > 1
                  ? `${g.items.length} finds`
                  : priceLabel(g.items[0])}
              </text>
            </g>
          ))}
        </svg>
        <div className="chart-caption">
          <Compass size={12} />
          {preview
            ? "Real source snapshots · simulated routes · approximate city pins."
            : "City-level pins · search routes, not sailing directions."}
        </div>
      </div>
      <div className="boat-selectors">
        {names
          .slice(0, workers.some((w) => w.id === "4") ? 4 : 3)
          .map((name, i) => {
            const w = workers.find((w) => w.id === String(i + 1));
            return (
              <button
                key={name}
                className={selectedWorker === String(i + 1) ? "selected" : ""}
                onClick={() =>
                  setSelectedWorker(
                    selectedWorker === String(i + 1) ? null : String(i + 1),
                  )
                }
              >
                <span style={{ background: colors[i] }} />
                {name}
                <small>{w?.status || "in port"}</small>
              </button>
            );
          })}
      </div>
      <div className="expedition-bottom">
        <div className="radio-log">
          <div className="log-title">
            <Radio size={14} />
            <strong>Ship-to-shore radio</strong>
            <span>
              {preview
                ? "SOURCE ARCHIVE"
                : calls.length
                  ? `${calls.length} recorded calls`
                  : "AWAITING ORDERS"}
            </span>
            {selectedWorker && (
              <button onClick={() => setSelectedWorker(null)}>Show all</button>
            )}
          </div>
          <div
            className="log-entries"
            role="log"
            aria-label={
              preview ? "Recorded discoveries" : "Real API call activity"
            }
            aria-live="off"
          >
            {preview && items.length ? (
              [...items]
                .reverse()
                .filter(
                  (item) => !selectedWorker || item.workerId === selectedWorker,
                )
                .map((item) => (
                  <div className="radio-entry complete" key={item.id}>
                    <span className="radio-dot" />
                    <div>
                      <strong>{item.location}</strong>
                      <span>{item.title}</span>
                    </div>
                    <small>recorded find</small>
                  </div>
                ))
            ) : calls.length ? (
              calls.slice(0, 18).map((c) => (
                <div className={`radio-entry ${c.status}`} key={c.id}>
                  <span className="radio-dot" />
                  <div>
                    <strong>{c.service}</strong>
                    <span>
                      {c.operation}
                      {c.target ? ` · ${c.target}` : ""}
                    </span>
                  </div>
                  <small>
                    {c.status === "running"
                      ? "calling…"
                      : c.statusCode
                        ? `HTTP ${c.statusCode}`
                        : c.status}
                    {c.finishedAt
                      ? ` · ${Math.max(0, (Date.parse(c.finishedAt) - Date.parse(c.startedAt)) / 1000).toFixed(1)}s`
                      : ""}
                  </small>
                </div>
              ))
            ) : (
              <p>
                {preview
                  ? "The boats are acting. The listings are real source snapshots. No APIs are called during playback."
                  : busy
                    ? "The captain is plotting search routes. Actual API activity will appear as the workers report in."
                    : "No mysterious numbers. No pretend progress. Send the ducks and watch the actual calls arrive."}
              </p>
            )}
          </div>
        </div>
        <div className="treasure-manifest">
          <div className="log-title">
            <MapPin size={14} />
            <strong>Treasure manifest</strong>
            <span>{items.length} FINDS</span>
          </div>
          {items.length ? (
            <div className="manifest-items">
              {items.map((item) => (
                <button key={item.id} onClick={() => onSelect(item)}>
                  <span>✦</span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>
                      {item.location || "Location unknown"} · {priceLabel(item)}
                    </small>
                  </div>
                  {points.some((p) => p.item.id === item.id) ? (
                    <MapPin size={13} aria-label="City location resolved" />
                  ) : (
                    <span className="unplaced-tag">
                      {item.locationPoint ? "outside US map" : "unplaced"}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="manifest-empty">
              <span>✦</span>
              <p>
                {preview
                  ? "Captain Quack is unfolding a very large map."
                  : "X marks the thing you probably don’t need."}
              </p>
              <button onClick={onSample}>
                Watch 20 boats appear <ExternalLink size={12} />
              </button>
            </div>
          )}
          {unplaced.length > 0 && (
            <p className="map-unplaced">
              {unplaced.length}{" "}
              {unplaced.length === 1 ? "find is" : "finds are"} outside this map
              or still need a city location. They remain in the manifest.
            </p>
          )}
        </div>
      </div>
      <div className="map-attribution">
        Coastline:{" "}
        <a
          href="https://github.com/topojson/us-atlas"
          target="_blank"
          rel="noreferrer"
        >
          US Census / US Atlas
        </a>{" "}
        · AI location parsing + city lookup:{" "}
        <a
          href="https://open-meteo.com/en/docs/geocoding-api"
          target="_blank"
          rel="noreferrer"
        >
          Open-Meteo / GeoNames
        </a>{" "}
        · Addresses are never inferred.
      </div>
    </section>
  );
}
