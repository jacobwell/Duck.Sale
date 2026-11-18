import type { Listing, SearchRun } from "./types";
import recordedBoats from "./recorded-boats.json";

// Source snapshots, not current inventory. Playback never calls a search API.
export const demoListings = recordedBoats as Listing[];
export const demoTotal = demoListings.length;
export function demoFrame(count: number): SearchRun {
  const listings = demoListings.slice(
    0,
    Math.max(0, Math.min(count, demoTotal)),
  );
  return {
    id: "recorded-voyage",
    query: "20 boats. Two coasts. A few very landlocked captains.",
    location: "US coasts & lakes",
    intent: "buy",
    budget: null,
    status: count >= demoTotal ? "complete" : "running",
    listings,
    workers: [
      "Pacific coast patrol",
      "Atlantic coast patrol",
      "Landlocked & loaded",
    ].map((name, i) => {
      const id = String(i + 1);
      const total = demoListings.filter((l) => l.workerId === id).length;
      const found = listings.filter((l) => l.workerId === id).length;
      return {
        id,
        name,
        query: "Recorded source tour · simulated route",
        status:
          found >= total ? "complete" : count === 0 ? "queued" : "searching",
        count: found,
        message: `${found} / ${total} recorded finds · no live API calls`,
        calls: [],
      };
    }),
    created_at: demoListings[0].retrievedAt,
    sample: true,
    recorded: true,
  };
}
export const demoRun = demoFrame(demoTotal);
