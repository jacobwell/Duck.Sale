# Boatduck / Craigsboat — build plan

## Product

Find the thing, anywhere. Lead with boats, GPUs/AI computers, Pokémon Elite Trainer Boxes and giant rubber ducks. Model/type/condition dropdowns build an editable query; custom requests remain supported. Ask in natural language, dispatch three independent search workers, and compare evidence-backed results.

## Implementation

1. Next.js App Router and TypeScript. Responsive nautical workspace: search brief, quick examples, worker activity, listing cards, saved items and comparison.
2. Boat.dev: one short-lived sandbox per search angle, three concurrent workers. Only create Boatduck sandboxes; stop them in finally and set a short TTL as a backstop.
3. Context.dev inside each worker: discover URLs, scrape page text and images, preserve page evidence and fetch errors. No invented listings or fallback to sample data during live searches.
4. Vercel AI Gateway: structured query planning and listing extraction; optional source-image analysis and labeled photorealistic fallback illustrations. Validate outputs and accept only URLs/images in retrieved evidence. Unknown price/status stays unknown.
5. Supabase Auth and Postgres: private runs, worker events, generations and usage, result JSON, saved listings. RLS on every table. Live API requires authentication and a database-backed admission limit.
6. A recorded 20-boat demo reveals real source snapshots on a draggable, zoomable US coastline map. Three animated boats cover both coasts and inland lakes. Pause, resume, replay and show-all controls work without credentials or paid calls. Live mode uses actual worker and HTTP call events. City lookup uses real geocoding, with uncertain locations left unplaced.
7. Vercel deployment and documented configuration. No local Node server management and no Playwright. Use lint, TypeScript, production compilation and direct integration checks; no unit tests requested or created.

## Delivery criteria

- Responsive search, filters, saving and comparison work.
- Live searches invoke Boat + Context + Gateway; isolated worker failure is visible, useful partial results survive.
- Every AI call has a generation ID and saved output/usage; every run has an addressable private URL.
- Source evidence, extraction confidence, retrieved time, unknown status and image limitations are visible.
- Missing credentials produce an actionable setup state, not fabricated results.
- Provider calls are bounded; sandboxes have TTL and explicit cleanup.

## Product roadmap — development, competitive position, and flow

### Positioning

Boatduck is a cross-site discovery and decision workspace for hard-to-search wants. Boat marketplaces such as [Boat Trader](https://www.boattrader.com/research/tips-on-virtual-boat-shopping/) and [YachtWorld](https://www.yachtworld.com/research/search-alerts/) already provide category filters and saved-search alerts. General shopping tools such as [Google Shopping](https://support.google.com/googleshopping/answer/10675605) emphasize merchant comparison and price insight. Boatduck should differentiate through one natural-language brief across sources and categories, visible source receipts, and an entertaining multi-agent voyage. It must describe coverage as partial when sources fail and must not imply marketplace-wide inventory or verified seller claims.

### Development scope and sequence

#### P0 — Finish the reliable search loop

- **Continue this voyage:** launch a follow-up search from partial or completed results, keep the original findings visible, pass prior source URLs and user feedback into query planning, and group runs by voyage lineage in history.
- **Make progress legible:** show queued/running/completed/failed states with real call receipts and useful worker messages; never animate work that did not happen.
- **Result steering:** hide a result, ask for more like it, or flag the wrong category; carry the steering note into the next voyage.
- **Account exit cleanup:** sign-out clears in-memory search, shortlist, selection, and pending stream state.
- **Trust details:** each result exposes source, retrieval time, price/status evidence and uncertainty; unknown fields remain unknown. Generated images remain explicitly labeled as illustrations.

**Done when:** a signed-in user can search, inspect partial results, continue with feedback, reload the linked voyage, and distinguish source facts from AI interpretation without losing prior finds. Admission stays server-side, duplicate sources are excluded, and concurrent/429 pacing limits remain in force.

#### P1 — Help people decide

- **Category-aware comparison:** boats compare length, year, make/model, hull/engine/condition and location; GPUs compare model, memory, seller price and source; Pokémon boxes compare set, product type, language/seal condition and price. Only show fields supported by evidence.
- **Better result controls:** sort by relevance, price where units/currencies match, distance when the location is resolved, and newest retrieval; add category-specific filters without hiding partial coverage.
- **Evidence conflicts:** flag when listing title, extracted details, price or status disagree across the same page; link every claim back to the source passage.
- **Image resilience:** retry/refresh a broken source image, retain a clear missing-photo state, and offer a labeled illustration only as a visual stand-in.
- **Voyage map:** keep the playful route visualization, but distinguish worker search routes from seller locations and label city-center pins as approximate.

**Done when:** users can compare up to three candidates with normalized, evidence-backed fields and understand which details are missing or conflicting.

#### P2 — Bring users back safely

- **Saved briefs and re-run:** save a search brief and manually launch another voyage from it.
- **Change detection:** compare a new run with prior source snapshots and highlight price/status changes only when the same source listing can be matched reliably.
- **Notifications:** add opt-in email only after SMTP, unsubscribe, frequency limits and delivery receipts are configured. Start with a user-triggered digest rather than continuous crawling.
- **Coverage controls:** show per-source success, partial reads, cooldowns and last checked times; let users retry only failed angles when safe.

**Done when:** returning users can re-run and understand what changed, with explicit consent and bounded provider work. Automatic purchase, seller messaging and continuous background crawling remain out of scope.

### Competitive lens

| Alternative | Strength users already get | Boatduck response |
|---|---|---|
| Boat Trader / YachtWorld | Boat-specific filters and saved-search notifications | Search across several public sources, preserve listing evidence, explain fit and gaps, and show the search process |
| Google Shopping / retailer search | Broad product discovery, merchant comparison, and price insights | Support unusual, used, local, and category-mixed requests; do not claim price history until Boatduck has enough repeated observations |
| Manual tabs / generic AI chat | Flexible research and summaries | Return addressable finds with original links/photos, retrieval receipts, uncertainty, filters, and a repeatable follow-up voyage |

The moat for the hackathon is the demonstrated end-to-end search workflow and its evidence trail, not exclusive inventory, exhaustive coverage, or always-current seller status.

### User flow

1. **Start:** choose Boats, GPUs/AI computers, Pokémon boxes, giant rubber ducks, or enter anything; set location, budget, intent and useful attributes.
2. **Dispatch:** review the interpreted brief, then send three bounded search angles. The map and ship-to-shore log reflect actual worker and provider events.
3. **Discover:** see partial findings as they arrive. Each card shows source image or an honest fallback, price/status, location, retrieval time, evidence and confidence/unknowns.
4. **Refine:** save, compare up to three, hide, request similar results, or flag a mismatch.
5. **Continue:** send another duck with the refinement note. Preserve earlier finds, avoid repeating known URLs, and show the new voyage as linked history.
6. **Return:** reopen a saved run or saved brief, manually re-run it, then review changed fields against the captured source evidence.
7. **Act:** open the seller/source page to confirm availability and details; Boatduck does not represent that a seller has independently verified the offer.

### Current implementation checkpoint

The repo includes the multi-category brief, three-worker flow, source evidence, live event map, demo voyage, saved items, basic comparison, labeled image fallback, and P0 continuation and steering with source-backed category details in comparison. A protected-preview integration run on November 18, 2026 completed a real California sailboat search and linked continuation: one verified find was retained across both voyages, one unique source was recorded, and all six worker sandboxes were stopped. Both voyages correctly reported partial coverage due to Context queue timeouts; no distinct new listing survived continuation deduplication. This validates the flow, not exhaustive coverage or a guaranteed new find. P2 change detection remains a proposed follow-on, not existing functionality.

## External eligibility

See HACKATHON.md. Builder acceptance, physical boat attendance, public photo and submission cannot be certified by application code. The private AI prize requires qualifying encrypted-token usage and independent verification; the default Gateway implementation does not claim it.
