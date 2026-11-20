# Feed the crew: DoorDash discovery

`/food` is an optional, signed-in food and retail discovery feature. Visitors choose a city, search restaurants or retail items, and follow a validated DoorDash store or product link. Ordering happens on DoorDash with the visitor's own account.

## Account boundary

- The only executable operations are the literal CLI `search` and `find-item-across-retailers` commands, with validated query, explicit latitude/longitude, a fixed limit and a fixed discovery-only purpose.
- No arbitrary command, flags, URL, saved-address ID or account ID can be supplied. `execFile` runs without a shell.
- No routes expose carts, ordering, checkout, payments, history, addresses, promotions or account management.
- The CLI process receives only the DoorDash access token and basic runtime environment. Other application secrets are not inherited.
- The raw DoorDash search response can include account and delivery-address metadata. It is never returned or logged. Only validated restaurant or product fields are projected into the API response. Store links are rebuilt from numeric store IDs. Product links must match the returned store and product IDs and only retain the product_id query parameter; account/session parameters are discarded.
- Search queries and locations are not saved by Duck.Sale. Supabase stores user ID and start/finish timestamps for admission control. DoorDash receives search queries, selected coordinates, and a fixed discovery-purpose message; its retention policies apply. This is separate from Private Mode.
- Restaurant photos load from DoorDash's public CDN. Browser requests to DoorDash links and photos are external requests.

Retail returns up to 12 items within five miles of the selected city point. Product names, stores and prices come directly from DoorDash. The response does not supply currency or photos, so currency is not inferred and no product photos are fabricated. Confirm currency and stock on DoorDash.

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
