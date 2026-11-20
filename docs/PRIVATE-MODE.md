# Private Mode / Secret Duck

Implemented as a separate /private page and /api/private/search route. Preview live verification passed: one source-supported match, partial source coverage, VPN exit verified, TLS exporter-bound gateway attestation verified, worker deletion completed. Admission metadata only; zero source-evidence rows and zero generation rows. Temporary verification user removed.

## Data boundary

The user writes and explicitly approves a public query independently of their private brief. Only that query goes to Boat/Context. The full brief is processed in Vercel memory and sent to the NYTE confidential-only endpoint with provider.min_privacy=confidential. There is no ordinary inference fallback. This is not browser-to-enclave encryption or zero trace. The official SDK verifies a fresh Google-signed gateway attestation against the published release policy, including TLS exporter binding. The inference request reuses that exact verified socket. NYTE enforces the upstream confidential policy; Duck.Sale does not independently verify the upstream model enclave.

Private content remains in React state, clears on pagehide or after 15 minutes, and is never intentionally written to browser storage or app search tables. The scuttle action aborts the browser request and clears state. It cannot prove physical RAM erasure, platform log deletion or third-party erasure. No private photos, telemetry, generated illustrations, map geocoding, saved searches, comparison exports or Telegram messages are sent automatically.

Supabase holds a constant placeholder search record and account/timing metadata for admission and shared Context rate limiting. Migration 007 serializes private voyages globally, since a single WireGuard identity cannot safely serve concurrent workers. Standard searches retain their existing functionality.

## VPN

DUCK_SALE_PRIVATE_VPN_JSON (or its legacy BOATDUCK_PRIVATE_VPN_JSON alias) holds a dedicated WireGuard identity and a pinned exit IP. The disposable Boat VM requires sudo, iproute2, WireGuard tools and kernel support. The static launcher creates the WireGuard interface in the host network namespace and moves it into an isolated namespace. Only that interface and loopback exist there, with an IPv4 default route through WireGuard and namespace-specific DNS. It checks api.ipify.org against expectedExitIp before running the source worker. No direct-network fallback exists. Context's remote crawlers do not inherit this VPN; only calls from the Boat worker use it.

WireGuard setup failures refuse discovery. A private sandbox requests no snapshots/monitoring and is deleted through deleteSandbox in finally. Receipt distinguishes API-confirmed deletion from TTL fallback. TTL only stops a VM and is not verified deletion. Boat can access VM memory and its uploaded VPN configuration; the private brief never reaches it. Dedicated VPN credentials must be revocable and scoped to this application.

## Required validation before promotion

- Migration 007 applied; dedicated Mullvad device Grown Ghost and TrustedRouter key configured as server-only secrets.
- Boat image supports WireGuard and namespace commands. Mullvad confirmed us-qas-wg-101 with exit 185.156.46.142.
- Tunnel-down check passed: HTTPS egress failed after bringing the WireGuard interface down.
- NYTE confidential pool returned HTTP 200 through Tinfoil-hosted DeepSeek Flash. Gateway TLS-exporter attestation verification passed before inference.
- Real private voyage and database audit passed. UI scuttle clears content; in-flight cancellation cleanup has not been separately exercised. No application logging of prompt/source/output content is implemented. Third-party logs are outside this audit.
- Chrome preview inspection confirmed layout, explicit query approval and scuttle clearing the query, brief and consent. No local server lifecycle actions.

## Provider credential check

The user-requested DeepSeek Flash France question returned HTTP 200 and “Paris.” via the ordinary TrustedRouter endpoint. A separate min_privacy=confidential request was refused with HTTP 400 (no matching route). This does not verify confidential inference. No API credentials are included in this document.

Verification receipts: private-vpn-verification.json, private-ai-verification.json, private-live-verification.json. Private Mode does not promise zero traces or deletion of infrastructure backups.

## Production release

November 19, 2026: promoted preview `dpl_Box2kMcFCrnQEUeLahMbEYAb5YjV` to production `dpl_EenXEhRx21QxoN3j657qibcfA9rp`, Ready at https://boatduck.vercel.app/private. Full private voyage was exercised on preview `dpl_5gq1iS2roytUfFJ9nvS8LEmK7bno`; subsequent changes expose attestation details in the UI, clear restored pages, tighten referrer policy, and bound trust-release fetch time. Final preview config, page, and unauthorized-request checks passed. No extra paid production search was made.


## Confidential query preparation and extraction

Private Mode now offers an optional **Let NYTE draft the public query** action before discovery. `POST /api/private/prepare` requires a signed-in Supabase user, calls the same attested confidential-only transport, and returns a draft for editing. It never calls Boat or Context. Approval is cleared when a draft is requested, the brief changes, or the public query is edited. The user must explicitly approve and send the final query. This is a human-reviewed suggestion, not a guaranteed automatic redaction system.

Migration `202611200008_private_preparation.sql` adds a service-only admission function and RLS-protected metadata table containing only ID, user ID, creation time and finish time. Preparation allows five attempts per user/hour, 30 globally/hour and one in-flight attempt per user (two-minute recovery window). It does not consume the separate search allowance. The existing hosted demo capability does not grant preparation access; hosted clients can still supply their own approved query.

NYTE also extracts optional price, location and availability strings while ranking. Each retained field must occur verbatim in its source markdown; unsupported fields become null. The UI displays source claims, not independently verified inventory or seller information. Ordinary Gateway/OpenAI inference is never used for these Private Mode steps. Briefs, drafts and results stay out of app persistence; hosted memory and external provider retention remain the documented boundaries.

### Verification of the expanded flow

Real NYTE query preparation passed locally and on a protected Vercel preview (4.2 seconds on the preview), using DeepSeek Flash with `tls-exporter` gateway binding. The sample name, occasion, and budget were omitted from the proposed query; discovery had not started. This is one checked example, not a redaction guarantee. Chrome verified that editing the private brief revokes approval, disables launch, and clearing the voyage empties both fields.

The new admission function rejects concurrent preparation and the hourly limit, and neither anon nor authenticated database roles can execute it directly. Verification-only quota inserts were rolled back. Lint, TypeScript, and the isolated production build passed during development.

Live discovery returned real pages and confirmed VPN egress and completed worker deletion. The initial expanded ranking failed on an overlong title; a subsequent response was truncated. The revised implementation shortens display titles, validates matches individually, preserves supported results with a partial flag, and uses a larger bounded output allowance. Final real-page ranking verification is **pending**: the provider returned HTTP 402 at its credit admission boundary. No ordinary inference fallback was used. The expanded flow is not yet promoted to production.
