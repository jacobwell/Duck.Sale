# Verification record

Verified November 17–18, 2026 against the dedicated Boatduck project.

- Lint and TypeScript checks pass; Next.js production build passes. Vercel production is https://boatduck.vercel.app.
- Real Boat + Context + Gateway boat search returned two individual Catalina listings with original photos. One extraction failed; the run correctly retained two results and reported `partial`. All three sandboxes were explicitly stopped. See `live-verification.json` for the source URLs, sandbox IDs, and recorded generation usage.
- A real Gateway image generation produced a photorealistic duck illustration. The check used an explicitly synthetic QA subject, then verified private Storage upload and signed-image retrieval. It did not create a live listing. See `image-verification.json`.
- Supabase owner access, denial of another user's rows, anonymous isolation, and denial of direct client access to the paid-work RPC passed. Disposable QA users and private images were removed afterward.
- Browser checks verified category changes and model dropdowns, including RTX 5090 and Prismatic Evolutions. Sample saving and comparison were also checked. Native accessibility interactions were used; no Playwright or local Node server management.
- Context MCP OAuth and the exact requested search succeeded. Its result was a low-relevance status-page hit, not a reliable list of new releases. See `context-mcp-verification.json`.
- Runtime dependency audit reports zero known vulnerabilities. Development tooling still has inherited picomatch-related advisories; the available automatic force fix proposes incompatible framework tooling changes and was not applied.

- Deployed authenticated DGX Spark search returned two real sources and reloaded its saved run (`deployed-verification.json`).
- Streaming worker telemetry records real Context request statuses, including rate limits, rather than estimated progress. A full fleet run returned one real giant-duck listing, preserved partial failures, and stopped all three sandboxes (`fleet-verification.json`).
- Low-reasoning Gateway extraction on captured source evidence completed in 11.683 seconds; both real Catalina locations resolved through the city geocoder (`extraction-verification.json`, `geocoding-verification.json`).
- The 20-boat demo uses individual source pages and source photos, with real city-center geocoding. Its reveal timing and boat travel are simulated. It does not fabricate sandbox IDs, API calls, seller availability, or precise berth coordinates.

## Remaining limits

- Live search coverage varies. Source rate limits, unreadable pages, timeouts, and invalid AI output can produce partial or empty results. These do not trigger sample substitution.
- Supabase email redirects are configured, but no custom SMTP provider is configured. Default email delivery is restricted; public signup and actual inbox delivery are not verified.
- Source-image extraction and generated illustrations are verified separately. Optional vision analysis (`BOATDUCK_VISION`) remains off and has not been live-verified.
- Seller availability, condition, authenticity and images are not independently inspected. Source quotes and retrieval times are evidence of what a page said, not guarantees of a current offer.
- Human hackathon eligibility and submission remain in `HACKATHON.md`.

No unit tests were requested or created. The integration check scripts are opt-in and use real provider credits.

## Final 20-boat demo verification

Production deployment `dpl_6FEmaLw1zT1qvgXSmNwVXckUL8hv` is ready at https://boatduck.vercel.app. The source snapshot contains 20 unique individual listing URLs, 20 original photo URLs (all returned HTTP 200 image responses), and 20 resolved city points. Six finds are Pacific, eight Atlantic, and six inland.

Native browser checks confirmed progressive reveal to 20, pause/resume, replay, show-all, zoom, drag and reset, plus an inland treasure detail with its original source photo, price and link. The initial SVG title hydration mismatch was fixed by rendering each tooltip as a single text string; a fresh production load and interactions produced no new console warnings/errors. The demo makes no search/API calls. No Playwright or local server lifecycle commands were used.

Final lint, TypeScript and isolated production build passed. Public configuration reports all four services configured; an unauthenticated paid search correctly returns HTTP 401. Existing live integration receipts above remain the evidence for provider execution, separate from demo playback.

## AI-assisted location resolution — November 18, 2026

The real saved `1980 38' Catalina 38` result had location `Alameda CA, California` with no coordinates. AI Gateway normalized it to Alameda / California / US and supplied an approximate geographic hint; Open-Meteo returned two same-name California places. The resolver selected the single matching candidate within 25 km of the hint and persisted GeoNames coordinates `37.77099, -122.26087`. A database read-back confirmed the point, and the US map projection accepts it. The original listing text and other listing fields were preserved. Real AI and geocoder call receipts were appended to the saved run. This validates the reported Alameda case, not every possible location string.

## Context discovery throttling — November 18, 2026

Production uses a database-backed, first-come, first-served permit for Boat worker search/scrape calls, with one request in flight and at least four seconds between completed requests. A 429 shares its cooldown across the fleet; the worker parses Retry-After seconds or dates and applies an exponential minimum plus jitter. Discovery evidence is emitted incrementally so command timeouts can retain already received source snippets/pages. Partial source coverage now marks the run partial even when extraction succeeds. Saved-search polling stops after terminal status, restores form fields only on initial load, and ignores stale responses after new-search/demo actions.

The first real throttled search retained one listing, with zero 429s, but one worker exhausted its queue budget before searching. This exposed permit starvation; the subsequent FIFO migration fixes ordering. A live production permit check verified exclusion, cooldown, and first-waiter priority (`queue-verification.json`). Anonymous HTTP access returns 401, and anonymous direct RPC execution returns database permission error 42501. The isolated verification users were removed.

Lint, TypeScript, worker-program syntax, and production deployment checks passed. No unit tests were added, no Playwright was used, and the user's local server was not managed. Optional vision remains separate from the discovery queue and disabled in production.

Final FIFO run (`throttle-verification.json`, deployment `dpl_GcfWNovXCHC6r3nnZoGRTFZTwqtm`): seven real Context calls, six HTTP 200 responses, zero HTTP 429 responses, and one request that failed without an HTTP response. Measured finish-to-next-start gaps were 4.807–5.192 seconds, with no overlapping Context requests. All three discovery searches succeeded; all three extraction generations completed; the run retained one real 1985 Catalina 30 listing in Santa Barbara, CA, and correctly reported partial coverage. All three sandboxes were explicitly stopped. Authenticated saved-run reload passed. The verification user and its private database records were removed. This validates pacing and partial recovery on this run; it does not guarantee provider quotas or exhaustive search coverage. The 429 retry branch was reviewed in code but was not exercised by this final run because the provider returned no 429s.

## Boat.dev snapshot-system incident — November 18, 2026

The user supplied Boat's incident notice: its overloaded snapshot system was causing general service issues, and remediation was underway. Earlier sandboxes were created but did not reach `ready`, and no Context calls were made. After recovery, an isolated disposable sandbox reached `idle` and was stopped cleanly. A subsequent authenticated protected-preview search and continuation completed against deployment `dpl_AYJnEkf1DiEWgCyw7yTjiBoj6FX5` (`https://boatduck-qa3t9s4na-jacobwells-projects.vercel.app`); the machine-readable receipt is `continuation-verification.json`. The parent and child runs each reported partial coverage, retained one real verified listing, linked the child as voyage 2, and carried the original find forward. There was one unique source across the continuation, so no new distinct listing survived deduplication. All six worker sandboxes were stopped, and the temporary verification user and its rows were removed. Context calls and AI extraction/geocoding completed where sources were available; several pages timed out or exceeded the worker time budget. This proves the feature works end to end under partial provider coverage, not that searches are exhaustive. The protected preview reports all four services configured. The verified build was promoted to production as `dpl_AWQf9f9dkztJL6TgV6jZnUYpPbK2`, reached `Ready`, and received the `https://boatduck-jacobwells-projects.vercel.app` alias. Production `/api/config` returned `ready: true` with Boat.dev, Context.dev, AI Gateway and Supabase configured; vision is off. The search and continuation were exercised on the same build in protected preview, while the production check verifies deployment readiness and configuration only.

## Private Mode — November 19, 2026

See PRIVATE-MODE.md and private-live-verification.json. A real protected-preview voyage returned one source-supported match with partial coverage. VPN exit 185.156.46.142 was confirmed as Mullvad us-qas-wg-101; a separate tunnel-down check blocked outbound HTTPS. NYTE confidential inference used a gateway TLS session verified with fresh hardware attestation. The worker deletion operation reached completed. The database held only the admission placeholder, with zero source-evidence and generation rows; the temporary user was removed. Chrome verified explicit query consent and scuttle clearing the form. Lint, TypeScript and Vercel builds passed. Production deployment dpl_EenXEhRx21QxoN3j657qibcfA9rp is Ready. This is not zero trace: hosted server memory, account/timing metadata, and external provider retention remain explicit boundaries.
