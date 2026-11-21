# Ten-seeker pilot

The opt-in `scripts/ten-seeker-pilot.ts` starts ten real Boat.dev sandboxes against ten coastal/lake searches. It uses the regular evidence, extraction, geocoding, deduplication, persistence and cleanup path. The ordinary public search still plans three Boat workers plus an optional DoorDash scout. The pilot is server-only; arbitrary public fleet sizes are not enabled.

Run with your own server environment and an existing search ID belonging to the account that should receive the saved result:

```sh
RUN_TEN_SEEKERS=1 PILOT_OWNER_RUN_ID=<existing-search-id> node --conditions=react-server --env-file=.env.local --import tsx scripts/ten-seeker-pilot.ts
```

This spends provider credits. It does not start a local server. Private receipts are written under ignored `.demo-access/`. Workers stop through the existing cleanup path, with the existing TTL fallback.

## November 20, 2026 results

- First run: 10 concurrent sandboxes, 33 Context calls, zero HTTP 429s, zero listings. Category-first traversal exhausted the worker budget before individual listings were reached.
- Revised run: 10 concurrent sandboxes, 33 Context calls, zero HTTP 429s, eight deduplicated source-backed finds in 151 seconds. Nine seekers completed and one failed before usable evidence was saved. All ten sandboxes were stopped. Three Context calls failed and source coverage was partial.
- The revised worker follows listing links immediately after the discovery page and preserves the first listing section when long marketplace navigation would otherwise consume its text limit. Pilot queries also use concrete boat models rather than broad categories.

- Third run: 15 source-backed finds in 158 seconds, 43 Context calls, zero Context failures or HTTP 429s. Nine seekers completed; Great Lakes failed structured AI extraction. All ten sandboxes stopped. This run used six shared Context slots and a 180-second pilot collection budget.
- Re-extracting the failed Great Lakes worker's saved evidence succeeded with two listings. This was an isolated extraction check; the saved ten-seeker run remains an honest 15-find partial run.
- Invalid extraction output now receives one fresh AI attempt with schema-specific instructions and the same evidence. Both generation attempts remain recorded. Persistent errors still surface as failures; source URL and quote checks are retained.

The first two runs used the three-request shared Context queue. The shared queue now allows six requests, preserving FIFO admission, cooldown and bounded leases. Public searches remain three seekers; only the opt-in pilot gets the longer collection budget. They do not establish support for ten simultaneous Context requests or a 100-worker fleet. Results may be sold, stale, outside the query's city, or lack a verified price; inspect the saved listing's source/status/caveats.
