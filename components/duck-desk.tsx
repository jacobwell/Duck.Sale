"use client";
import { useState } from "react";
import { Duck } from "./duck";
import { personality } from "@/lib/personality";
import type { CategoryId } from "@/lib/categories";
export function DuckDesk({
  category,
  busy,
}: {
  category: CategoryId;
  busy: boolean;
}) {
  const [taps, setTaps] = useState(0);
  const copy = personality[category];
  return (
    <div className={`duck-desk ${category} ${busy ? "on-duty" : ""}`}>
      <div className="duck-office-label">
        <span /> DEPARTMENT OF WANTING THINGS
      </div>
      <div className="duck-speech" aria-live="polite" key={taps}>
        {busy
          ? "Be right back. Interrogating the internet."
          : copy.quotes[taps % copy.quotes.length]}
      </div>
      <button
        type="button"
        className="desk-mascot"
        aria-label="Ask the duck for questionable advice"
        onClick={() => setTaps(taps + 1)}
        disabled={busy}
      >
        <span className="duck-shadow" />
        <span className="desk-duck">
          <Duck size={140} />
          {category === "boats" && <span className="duck-hat">⚓</span>}
          {category === "compute" && <span className="duck-visor" />}
          {category === "pokemon" && <span className="duck-card">✦</span>}
          {category === "ducks" && <span className="duck-crown">♛</span>}
        </span>
        <span className="duck-tap-hint">
          {taps >= 5
            ? "EMPLOYEE OF THE POND ★"
            : "click for questionable advice ↗"}
        </span>
      </button>
      <div className="duck-nameplate">
        <strong>{copy.title}</strong>
        <span>Unlicensed. Unbothered. On your side.</span>
      </div>
    </div>
  );
}
