# Fleet pilots (10, 25 or 100 seekers)

The opt-in `scripts/ten-seeker-pilot.ts` starts ten real Boat.dev sandboxes by default, or 25 with `PILOT_SEEKERS=25` against ten coastal/lake searches. It uses the regular evidence, extraction, geocoding, deduplication, persistence and cleanup path. The CLI pilot uses fixed regional queries. The public search now defaults to three workers and offers 3, 5, 10 or 25 seekers, plus 50 and 100 when super mode is enabled in the URL. Its AI planner creates the selected number of angles; an optional DoorDash scout is separate.

Run with your own server environment and an existing search ID belonging to the account that should receive the saved result:

```sh
RUN_TEN_SEEKERS=1 PILOT_OWNER_RUN_ID=<existing-search-id> node --conditions=react-server --env-file=.env.local --import tsx scripts/ten-seeker-pilot.ts
```

Set `PILOT_SEEKERS=25` alongside those variables for the larger pilot. This uses the shared Context queue (now ten slots after the operator reported a Pro upgrade) and 180-second collection budget per seeker. The public API cannot choose a fleet size.

This spends provider credits. It does not start a local server. Private receipts are written under ignored `.demo-access/`. Workers stop through the existing cleanup path, with the existing TTL fallback.

## November 20, 2026 results

- First run: 10 concurrent sandboxes, 33 Context calls, zero HTTP 429s, zero listings. Category-first traversal exhausted the worker budget before individual listings were reached.
- Revised run: 10 concurrent sandboxes, 33 Context calls, zero HTTP 429s, eight deduplicated source-backed finds in 151 seconds. Nine seekers completed and one failed before usable evidence was saved. All ten sandboxes were stopped. Three Context calls failed and source coverage was partial.
- The revised worker follows listing links immediately after the discovery page and preserves the first listing section when long marketplace navigation would otherwise consume its text limit. Pilot queries also use concrete boat models rather than broad categories.

- Third run: 15 source-backed finds in 158 seconds, 43 Context calls, zero Context failures or HTTP 429s. Nine seekers completed; Great Lakes failed structured AI extraction. All ten sandboxes stopped. This run used six shared Context slots and a 180-second pilot collection budget.
- Re-extracting the failed Great Lakes worker's saved evidence succeeded with two listings. This was an isolated extraction check; the saved ten-seeker run remains an honest 15-find partial run.
- Invalid extraction output now receives one fresh AI attempt with schema-specific instructions and the same evidence. Both generation attempts remain recorded. Persistent errors still surface as failures; source URL and quote checks are retained.

The first two runs used the three-request shared Context queue. At the time of the ten-seeker run, the shared queue allowed six requests, preserving FIFO admission, cooldown and bounded leases. At that point public searches used three seekers. Larger public fleets now also use the longer collection budget. They do not establish support for ten simultaneous Context requests or a 100-worker fleet. Results may be sold, stale, outside the query's city, or lack a verified price; inspect the saved listing's source/status/caveats.

## 25-seeker run

Run `480bc516-72d5-4d45-8f16-a43a38dfa7c2` completed in 210 seconds with 45 deduplicated source-backed finds. All 25 seekers completed; all 25 sandboxes stopped. There were 116 Context calls, zero 429s and one failed BoatTrader scrape. Nine seekers had partial source coverage; the run remains partial rather than claiming every page succeeded.

The run started with six shared Context slots. At 2026-11-21 01:45:14 UTC, after the operator reported upgrading to Pro, capacity was raised to ten; measured peak Context concurrency was ten. This is a mixed-capacity run, not a clean six-slot benchmark. The Pro pricing page lists 100 concurrent requests, but the application intentionally remains capped at ten. The public search default remains three seekers plus an optional retail scout.

## 100-seeker pilot

Set `PILOT_SEEKERS=100` for 25 coastal/lake locations with four distinct model/brand searches per location. Launches are staggered 1.2 seconds apart (about 50 starts/minute, below the operator-reported 65/minute Boat cap). This is 100 total seekers, not a promise of 100 simultaneously running sandboxes. Context retains a shared ten-request limit. The overall local pilot deadline is ten minutes; each worker retains the 180-second collection window and cleanup/TTL protection. This remains server-only.

Run `b65fb250-9b66-41f6-9d43-420d7e28734a`: 100 seekers completed in 322 seconds with 87 deduplicated source-backed finds. All 100 sandboxes stopped; peak allocated/searching was 92, not 100. There were 260 Context calls, peak concurrency ten, zero 429s and five failed calls. One structured extraction generation failed and its bounded retry recovered; no seekers failed. Coverage remains partial.

The user explicitly requested this paid pilot after the account's five-search hourly allowance was consumed by earlier checks. `PILOT_OPERATOR_ADMISSION=1` permits that local admin script to admit the requested run after checking no existing account search is running. Public search admission and its limits remain unchanged. No development servers are started by the script.

The UI now includes an accessible numbered SVG dispatch dock with queued, warming-up, searching, extracting, returned and failed phase counts, plus independent sandbox launch/cleanup counts. Berths select the worker's recorded API calls. Counts reflect real persisted worker state; returned does not imply that worker found a listing.
