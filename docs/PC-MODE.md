# Silicon shipyard: bonus PC mode

Open `/pc`, sign in through the main page, and enter a tower-only USD budget ($500–$20,000), shopping location and use case. The flow proposes eight exact models: CPU, motherboard, RAM kit, GPU, storage, PSU, case and cooler. Dollar allocations are planning targets; they are not verified seller prices or a checkout total.

NY Token Exchange / TrustedRouter handles planning and compatibility inference through the existing attested confidential transport (`nyte/confidential`). There is no ordinary inference fallback. Context.dev researches each proposed model sequentially through the shared Context FIFO/concurrency controls. This standalone research path runs on the server, not in Boat sandboxes. “Find exact offers with the fleet” opens the main search with the model, shopping location and target budget filled in; launching it uses the usual fleet, including eligible DoorDash discovery.

The review covers socket, memory generation, motherboard/case form factor, GPU fit, cooler mounting/clearance, power/connectors, BIOS and storage interface. It uses returned search snippets, not full physical measurements or hardware validation. Evidence quotations must be exact substrings of a returned source. Unsupported claims become `verify`. A supported check requires at least two cited source IDs; BIOS remains a manual check. Model judgment is still fallible. Manufacturer support lists and exact purchased revisions take precedence.

Sources can be retailer listings, manufacturer specifications, category pages or other search results. No source is presented as a confirmed in-stock offer. Missing evidence stays explicit; there is no fabricated live-price total. The review does not certify the machine, installation, firmware or electrical safety.

## Setup

Apply migrations with `node --env-file=.env.local scripts/migrate.mjs`. Existing Supabase, `TRUSTEDROUTER_API_KEY` and `CONTEXT_DEV_API_KEY` settings are required. The main-search handoff additionally needs the standard fleet services.

PC builds share the existing search admission caps (five per user per hour, thirty globally). Build payloads are saved in `pc_builds`, protected by RLS and owner checks. The backing search run participates in Context admission and appears in history with a link back to the PC build. Inference receives the brief and public sources; Context receives model searches and shopping location. This is not Private Mode.

The server owns completion after a browser disconnect. The saved `/pc?id=…` URL reloads and polls an active build. The overall deadline is 265 seconds; older abandoned builds are marked incomplete on reload. Partial plans and research are retained. A download contains models, allocations, source links and compatibility notes.
