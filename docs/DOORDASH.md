# Feed the crew: DoorDash discovery

`/food` is an optional, signed-in restaurant-discovery feature. Visitors choose a city, search for food, and follow a canonical DoorDash store link. Ordering happens on DoorDash with the visitor's own account.

## Account boundary

- The only executable operation is the literal CLI `search` command, with validated query, explicit latitude/longitude, a fixed limit and a fixed discovery-only purpose.
- No arbitrary command, flags, URL, saved-address ID or account ID can be supplied. `execFile` runs without a shell.
- No routes expose carts, ordering, checkout, payments, history, addresses, promotions or account management.
- The CLI process receives only the DoorDash access token and basic runtime environment. Other application secrets are not inherited.
- The raw DoorDash search response can include account and delivery-address metadata. It is never returned or logged. Only validated restaurant fields are projected into the API response. Store links are rebuilt from numeric store IDs; account/session query parameters cannot escape in links.
- Search queries and locations are not saved by Duck.Sale. Supabase stores user ID and start/finish timestamps for admission control. DoorDash receives search queries, selected coordinates, and a fixed discovery-purpose message; its retention policies apply. This is separate from Private Mode.
- Restaurant photos load from DoorDash's public CDN. Browser requests to DoorDash links and photos are external requests.

## Limits

Ten searches per account per hour, sixty across the feature per hour, one active search per account, and at most three active globally. Each CLI process has a 55-second timeout and a 1 MB output limit. Admission slots recover after 90 seconds. Search results are city-level candidates, not delivery quotes. Availability, fees and prices must be confirmed on DoorDash. No account-specific discounts, fees or estimated delivery times are displayed.

## Setup and expiry

The official CLI requires DoorDash beta approval. Version 0.2.6 is pinned; the Linux archive is verified against the release SHA-256 before extraction during `npm run build`. The binary lives in ignored `.vendor/` and is included only in the food-search function's deployment trace.

Use the official CLI `export-token` flow on your trusted computer. Store these **server-only** variables in Vercel and your ignored `.env.local`:

- `DD_CLI_ACCESS_TOKEN`: exported credential, marked Sensitive in Vercel.
- `DOORDASH_TOKEN_EXPIRES_AT`: exported ISO expiry timestamp.
- `DOORDASH_DISCOVERY_ENABLED=true`: set false to disable this feature immediately after deploying that environment change.
- `DOORDASH_CLI_PATH`: local macOS executable path only; deployment uses the pinned Linux path.

The CLI reports approximately 72-hour token validity. Reauthorize before expiry, replace the server variables, and deploy again. Do not paste tokens into chat, source, logs or README examples. An absent/expired token disables search with an explicit unavailable state and a link to DoorDash. The underlying beta credential has broader capabilities; the application's fixed command and response projection provide the search-only boundary, not a read-only DoorDash OAuth scope.

Apply the database migration with `node --env-file=.env.local scripts/migrate.mjs`.

## Source

Official CLI and release: https://github.com/doordash-oss/doordash-cli/releases/tag/v0.2.6

## Verification — November 20, 2026

- Official v0.2.6 macOS release checksum verified before local use; Linux checksum pinned in build script.
- Local sanitized search returned eight restaurants.
- Vercel preview Linux search returned eight restaurants in 3.4 seconds, using the bundled binary.
- Unauthenticated search rejected with HTTP 401; an extra arbitrary `command` property rejected with HTTP 400.
- City lookup returned a selectable San Francisco result.
- Response checked against the explicit public-field allowlist, excluding the raw account/address envelope.
- Lint, TypeScript and production compilation passed. No order, cart, payment or account-history operations were invoked.
