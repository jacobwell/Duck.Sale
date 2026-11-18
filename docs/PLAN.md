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

## External eligibility

See HACKATHON.md. Builder acceptance, physical boat attendance, public photo and submission cannot be certified by application code. The private AI prize requires qualifying encrypted-token usage and independent verification; the default Gateway implementation does not claim it.
