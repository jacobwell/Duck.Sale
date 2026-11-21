"use client";
import type { WorkerState } from "@/lib/types";
const phases = {
  queued: { label: "Queued", color: "#74796c", fill: "#eff0e7" },
  starting: { label: "Warming up", color: "#966015", fill: "#fae9bd" },
  searching: { label: "Searching", color: "#276878", fill: "#d7edf0" },
  extracting: { label: "Extracting", color: "#745291", fill: "#ece2f5" },
  complete: { label: "Returned", color: "#3f674b", fill: "#dfedda" },
  failed: { label: "Failed", color: "#a34036", fill: "#fae2de" },
} as const;
export function FleetDock({
  workers,
  selected,
  onSelect,
}: {
  workers: WorkerState[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  if (!workers.length) return null;
  const launched = workers.filter((w) => w.sandboxId).length;
  const stopped = workers.filter((w) => w.cleanup === "stopped").length;
  const columns = Math.min(10, workers.length),
    rows = Math.ceil(workers.length / columns);
  return (
    <section className="fleet-dock" aria-label="Fleet launch tracker">
      <div className="dock-heading">
        <strong>⚓ Dispatch dock</strong>
        <span>
          {launched} / {workers.length} sandboxes launched · {stopped} stopped
        </span>
      </div>
      <div className="dock-counts" aria-label="Seeker phases">
        {Object.entries(phases).map(([key, phase]) => (
          <span key={key} style={{ borderColor: phase.color }}>
            <b>{workers.filter((w) => w.status === key).length}</b>{" "}
            {phase.label}
          </span>
        ))}
      </div>
      <details open={workers.length > 4}>
        <summary>
          Numbered berths · select a seeker to inspect its calls
        </summary>
        <div className="dock-scroll">
          <svg
            viewBox={`0 0 ${columns * 86} ${rows * 48 + 10}`}
            style={{ minWidth: Math.min(columns * 65, 650) }}
            aria-label="Numbered seeker berths"
          >
            {workers.map((w, i) => {
              const phase = phases[w.status],
                x = (i % columns) * 86,
                y = Math.floor(i / columns) * 48;
              return (
                <g
                  key={w.id}
                  transform={`translate(${x},${y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Seeker ${w.id}, ${w.name}: ${phase.label}${w.sandboxId ? ", launched" : ", not yet launched"}${w.cleanup ? `, ${w.cleanup}` : ""}`}
                  onClick={() => onSelect(w.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(w.id);
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <title>{`${w.name}: ${phase.label}${w.partial ? " · partial coverage" : ""}${w.sandboxId ? ` · ${w.sandboxId}` : ""}`}</title>
                  <rect
                    x="4"
                    y="4"
                    width="76"
                    height="38"
                    rx="6"
                    fill={phase.fill}
                    stroke={selected === w.id ? "#172c23" : phase.color}
                    strokeWidth={selected === w.id ? 3 : 1}
                  />
                  <path
                    d="M12 26h20l-5 7H17z M22 12v13 M24 13l7 10h-7z"
                    fill={phase.color}
                    stroke={phase.color}
                    strokeWidth="1.2"
                  />
                  <text
                    x="55"
                    y="28"
                    textAnchor="middle"
                    fontSize="15"
                    fontWeight="700"
                    fill={phase.color}
                  >
                    {w.id}
                  </text>
                  {w.partial && <circle cx="74" cy="10" r="3" fill="#b07b20" />}
                </g>
              );
            })}
          </svg>
        </div>
      </details>
      <p>
        Colors show real worker status. Returned means the seeker finished, even
        with zero finds. An amber dot means partial coverage. Stopped means
        sandbox cleanup.
      </p>
    </section>
  );
}
