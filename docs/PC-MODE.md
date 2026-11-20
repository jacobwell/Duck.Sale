# Silicon shipyard: PC mode

Open `/pc`, sign in through the main page, and enter a tower-only USD budget ($500–$20,000), shopping location and use case. The flow proposes eight exact models: CPU, motherboard, RAM kit, GPU, storage, PSU, case and air cooler. Dollar allocations are spending targets, not seller prices or a checkout total.

## How verification works

1. NY Token Exchange / TrustedRouter plans specific parts through the existing attested confidential transport (`nyte/confidential`). No ordinary inference fallback.
2. Context.dev searches for each exact model, preferring its manufacturer's domain. Up to two search-result manufacturer pages per part are read through the shared Context admission queue, plus one specifications link discovered on those pages when available. Search snippets remain useful links but cannot establish a supported specification check.
3. NYTE extracts structured facts in small batches (at most two inference calls concurrently), retaining completed batches if another fails. It extracts facts with exact source quotations and a model identity quotation (or exact SKU). The server rejects facts with missing quotes, wrong domains, missing model identity or values absent from their quotations. Numeric conversions are not inferred. This is conservative: differently spelled product identities may need manual verification. Category prose is ignored when matching names, but numeric model IDs, variant suffixes and revisions are preserved.
4. Code compares sockets, RAM generation/capacity/module count, board/case form factor, GPU length, cooler socket/height, PSU dimensions/form factor, power headroom/cables and storage compatibility. Conflicting official scalar values become unknown. Missing list entries never prove incompatibility.
5. A concrete conflict can trigger one correction of at most two parts if enough runtime remains. Changed parts are researched again and their old evidence/review discarded. Unverified corrections never inherit an earlier pass.

The page displays supported checks, conflicts, unresolved checks and manufacturer-page coverage. This is **evidence coverage, not a probability of success**. Conflicts appear first. Sources include capture time and whether a full manufacturer page or only a search snippet was read. Previous saved builds explicitly retain the older review label.

## Conservative planning rules

GPU length reserves 10 mm, cooler height 3 mm and PSU length 10 mm beyond the published dimension. These are planning allowances, not replacements for installation instructions. PSU target is the higher of the GPU vendor recommendation and `(CPU maximum package power + GPU maximum board power + 100 W) × 1.25`. CPU base TDP must not be substituted for maximum package power. Required GPU and motherboard power connections are compared to independent supplied PSU cables; an adapter or daisy chain is not assumed compatible.

BIOS remains a purchase check: exact board revision, CPU support list, minimum BIOS and seller-shipped firmware must agree. RAM QVL/overclock profiles, cooler/RAM interference, GPU thickness and cable bend radius, actual fan/radiator/cage layout, included brackets, fan/front-panel headers and exact PSU cable compatibility also remain explicit manual checks. This is not hardware certification. Manufacturer pages and extraction can still be incomplete or wrong.

## Purchasing and privacy

“Find exact offers with the fleet” opens the main search with the model, shopping location and target budget filled in. Launching uses the ordinary fleet and eligible DoorDash scout. PC research itself runs on the server, not in Boat sandboxes. It does not certify stock or produce a verified whole-build live-price total.

Builds are saved in `pc_builds` with RLS and owner checks, and appear in history. Inference receives the brief and public evidence; Context receives model queries. This is not Private Mode. Downloads contain parts, allocations, sources, corrections, research gaps and review notes.

## Setup and operation

Apply migrations with `node --env-file=.env.local scripts/migrate.mjs`. Existing Supabase, `TRUSTEDROUTER_API_KEY` and `CONTEXT_DEV_API_KEY` settings are required. The main-search handoff additionally needs the fleet services.

PC builds share search admission caps (five per user per hour, thirty globally). Calls use the shared Context permit/cooldown; no extra unbounded parallel scraping. The initial research stage is capped to reserve time for inference and persistence within the 265-second job deadline. Research failures remain visible. No new database migration is required for version 2; payload fields are additive.

The server owns completion after browser disconnect. Saved `/pc?id=…` URLs reload and poll active builds. Older abandoned builds become incomplete on reload; partial research is preserved.
