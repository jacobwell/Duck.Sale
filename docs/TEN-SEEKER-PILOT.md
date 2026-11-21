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

These runs used the existing three-request shared Context queue. They do not establish support for ten simultaneous Context requests or a 100-worker fleet. Results may be sold, stale, outside the query's city, or lack a verified price; inspect the saved listing's source/status/caveats.
