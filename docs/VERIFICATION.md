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
