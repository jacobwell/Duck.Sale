# Duck.Sale

**Find your next whatever.** A small fleet of agents searches the web for specific things: boats, GPUs and AI computers, Pokémon Elite Trainer Boxes, and giant rubber ducks—or any custom request.

Next.js App Router · Supabase · Boat.dev · Context.dev · Vercel AI Gateway

## What it does

- Turns a plain-English request, location, budget and buy/rent preference into three search angles.
- Launches three isolated Boat.dev sandboxes. Each worker runs a fixed Node program that uses Context.dev search and page extraction.
- Collects original source URLs, page text, source images, retrieval timestamps, and partial errors.
- Uses structured AI Gateway output to normalize listings and explain matches. Unknown prices and statuses stay unknown. Only source URLs and images actually returned by the workers are accepted.
- Streams worker progress and incremental results. Saves runs, source evidence, AI outputs and usage in Supabase before marking the job complete.
- Supports private search URLs, email-link authentication, a saved shortlist, source/status/price filters, and comparison of up to three finds.
- Offers category/model/condition dropdowns (including DGX Spark 128GB, RTX 5090/5080/4090, 151 and Prismatic Evolutions ETBs).
- Generates on-demand photorealistic illustrations when a live listing lacks a source photo. Every generated image is labeled “AI illustration · not the actual item,” stored privately, and never treated as evidence.
- Includes a recorded 20-boat voyage across the Pacific and Atlantic coasts, Lake Michigan, Lake of the Ozarks and the Austin lake area. Real source snapshots and photos appear progressively on an interactive US map. Playback is explicitly simulated, with no live API calls, and never substitutes for failed live results.
- Animates three search boats with actual live worker activity and API call receipts. Click treasure pins for source details; zoom and drag the map. City coordinates come from Open-Meteo / GeoNames, never invented addresses.
- Adds category-specific duck commentary and a free “Feeling ducky” mission picker.

## Local development

Install dependencies with `npm ci`. The user owns the development server. When ready, **the user** runs `npm run dev` on port **3000**. Do not launch a second server, use port 3001, or stop/restart an existing Node process.

Credentials belong in ignored `.env.local`, never source files. See `.env.example` for names. Vercel linking and the dedicated Supabase integration have been provisioned for this project; do not connect an unrelated database.

| Variable                        | Purpose                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| `BOAT_API_KEY`                  | Create, execute and stop Duck.Sale sandboxes                        |
| `CONTEXT_DEV_API_KEY`           | Search/scrape from inside each worker                              |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public, RLS-protected Supabase client                              |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only run/generation writes                                  |
| `VERCEL_OIDC_TOKEN`             | Local Gateway authentication, pulled from Vercel; expires          |
| `AI_GATEWAY_API_KEY`            | Optional alternative to Vercel OIDC                                |
| `AI_MODEL`                      | Optional model override; default verified from the Gateway catalog |
| `DUCK_SALE_VISION`               | `true` to analyze one source image per worker; default `false`     |

`vercel env pull` replaces its destination. Pull to `.env.vercel.local` and deliberately merge with `.env.local` to preserve locally supplied Boat/Context keys. Never print values.

## Database and authentication

Schema lives in `supabase/migrations/`. Apply new migrations after linking and verifying credentials:

```sh
node --env-file=.env.local scripts/migrate.mjs
```

The migration runner uses the supplied Supabase public root CA with certificate and hostname validation. It records applied migrations and wraps schema changes in a transaction.

Tables: `search_runs`, `source_evidence`, `generations`, `saved_listings`. All have RLS; the authenticated browser can only read its own searches/evidence/generations and manage its own saved items. Paid work is admitted by a server-only SQL function with transactional limits: five searches per user per hour, one active search per user, and 30 searches across the fleet per hour.

Supabase Auth's Site URL is configured for `https://duck.sale`, with that domain and `http://localhost:3000/**` allowed for redirects. Email authentication is enabled. For public signups beyond Supabase's default email restrictions, configure a mail provider in Supabase Auth. The app never sends outreach; email links are only requested by users signing in.

## Lifecycle and limits

Each live search uses up to three small Boat sandboxes, up to 15 source pages and scrapes, one planning generation, up to three extraction generations, and up to three location-normalization generations. Context and Gateway bill per their current plans. Boat sandboxes have a 240-second TTL and are explicitly stopped in `finally`; no account secrets are inherited and snapshots/monitoring are off. Only the Context key is injected. Discovery search/scrape requests share a Supabase-backed permit across all workers and app instances: one request at a time in first-come, first-served order, with at least four seconds after each completed request. HTTP 429 responses publish a fleet-wide cooldown, honoring Retry-After (seconds or HTTP date, capped at 24 hours), with a 10/20/40-second exponential minimum plus jitter and at most three attempts per request. Workers retain source snippets and completed page reads when their 120-second discovery budget expires; those runs are marked partial. This reduces bursts but cannot override provider quotas or traffic from other apps using the same key. Optional source-image analysis is separate from the discovery queue. If cleanup fails, the UI records the TTL fallback.

Searches run in a 300-second Vercel function. `after()` keeps the completion promise attached to the invocation after a client disconnect; the overall job has a 260-second signal. Progress and output are persisted throughout. This is a bounded hackathon pipeline, not an unlimited durable crawler: platform termination may interrupt a run. Stale runs are marked failed on the next admission, and sandbox TTL remains the cleanup backstop.

Source pages are untrusted. They do not become shell instructions or agent tools. Workers reject private/local targets before page scraping; the browser scraping provider enforces its own redirect/network policy. Source-image analysis uses Context bytes instead of fetching arbitrary URLs from the Vercel server. Listing images are direct source links and may expire, hotlink-block, or be removed; the UI has a missing-photo state. Image rights remain with the original source.

Price ordering groups by currency and unit first; purchase prices and rental rates are not treated as comparable. No FX conversion, seller messaging, automatic purchase, recurring monitoring, or authenticated marketplace crawling is implemented. Browser rendering is supplied by Context's scraping service.

Generation token usage is persisted. `estimated_cost_usd` is nullable until cost estimation is configured; null is not zero. Gateway's dashboard is the billing source of truth.

Image generation uses `AI_IMAGE_MODEL` (default `bfl/flux-3-image-klein`) through Gateway. Limits are six illustrations per user per hour and 40 across the app. Signed image links expire after one hour and are refreshed on loading a saved search or shortlist. Private image generation and account isolation were verified using disposable synthetic QA records, separately from live listing verification.

## Verification

```sh
npm run lint
npm run typecheck
npm run build:check
```

`build:check` writes to `.next-build`, preserving the user's `.next` dev output. No unit tests were requested or created. `scripts/live-check.ts` is an opt-in paid integration check, not a unit test: it creates an isolated temporary auth user, performs one real search, saves a sanitized receipt and removes that user and its rows.

```sh
node --conditions=react-server --env-file=.env.local --import tsx scripts/live-check.ts
```

## Deployment

Project: `jacobwells-projects/duck-sale`. The Supabase project display name is `Duck.Sale` (its Vercel Marketplace resource identifier remains `boatduck-db`), installed through the existing Vercel Supabase integration. Check its billing in the Vercel/Supabase dashboard; Marketplace lists the Pro offering from $25/month.

Use `vercel deploy` for a preview and verify before promoting. API keys must be set on the matching Vercel environment. Gateway uses project OIDC on Vercel.

## Hackathon

[Build plan](docs/PLAN.md), [eligibility checklist and demo script](docs/HACKATHON.md). The `/hackathon` page makes outstanding human requirements explicit. Builder acceptance, code shipped aboard a boat, a tagged public boat photo, submission and Demo Day acceptance still require evidence. **No encrypted/private-inference prize qualification is claimed.**

## Context.dev MCP

Project configuration is in `.codex/config.toml`, using `https://mcp.context.dev/mcp` and OAuth. Codex login succeeded. A real MCP `web-search` invocation for “What's new on context.dev this week?” succeeded; the dated request receipt is in `docs/context-mcp-verification.json`. New sessions load the configured tools. The app uses its own Context API key, separate from Codex OAuth.

AI Gateway normalizes listing locations in a recorded batch per worker (for example, “Alameda CA, California” becomes Alameda / California / US). Open-Meteo / GeoNames then supplies coordinates for a matching city, region and country. When multiple cities share that name and region, AI’s approximate city coordinates can select a single geocoder candidate within 25 km; model coordinates are never displayed directly. Successful resolutions are cached for up to 24 hours; errors and misses are not cached. Country-only, shipping-only and unresolved ambiguous locations remain unplaced. Coordinates are approximate city centers, never seller addresses. International cities retain coordinates and a maps link, but are marked outside the US map. The geocoder uses Open-Meteo’s free noncommercial endpoint for this hackathon. Commercial use requires an appropriate license/API key (`OPEN_METEO_API_KEY`). Recorded demo sources are in `lib/recorded-boats.json`; their prices and photos are snapshots, not claims of current inventory.

Boat workers call the public `/api/context-permit` endpoint using short-lived, run-scoped signed tokens. The Supabase service key stays on the app server. The production permit origin defaults to `https://duck.sale`; set `DUCK_SALE_APP_URL` to a publicly reachable deployment of this app when using a different installation. Apply migrations `202611180004_context_throttle.sql` and `202611180005_context_fifo.sql` before deploying the throttled workers.

## Brand and compatibility

The product is Duck.Sale and its GitHub repository is `jacobwell/Duck.Sale`. The existing `boatduck-db` Supabase resource, migration ledger, illustration bucket, worker protocol filenames, and signed-token namespace retain their original identifiers to preserve existing data and in-flight work. Legacy `BOATDUCK_*` environment variables remain supported as fallbacks for `DUCK_SALE_*`. Historical verification receipts describe the original release. Demo title cards and the deck use Duck.Sale; captured application footage remains unchanged.
