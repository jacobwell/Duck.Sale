# Hosted search access

The maintainer’s server runs Boat, Context, AI, and Supabase on behalf of a client. This is an opt-in, limited API capability, not an open proxy and not a Supabase login.

## For a judge

1. Receive `client.env` privately from the maintainer.
2. Save it as `.env.hosted.local` beside `package.json`.
3. Run `npm run search:hosted -- --check` to confirm access without paid work.
4. Run `npm run search:hosted -- "Used Catalina 30 sailboat California"`.

No local Next.js server, provider account, or local database is needed for the CLI. Node 22+ is enough to run the script directly. Normal website sign-in remains available at https://duck.sale.

The script prints real NDJSON search events. Standard searches are stored under a dedicated demo account on the backend. A shared demo token shares that account’s admission limits; it does not grant access to account history.

## Private API request

Create a local JSON file, outside version control, containing:

```json
{
  "publicQuery": "giant inflatable duck for sale United States",
  "brief": "A surprise party gift. Prefer a compact inflatable under my budget.",
  "approved": true
}
```

`approved: true` explicitly authorizes sending the publicQuery to discovery providers. Keep private details only in `brief`.

```bash
npm run search:hosted -- --private /absolute/path/to/request.json
```

The request goes to `/api/demo/private-search`; it uses the same confidential-only and VPN requirements as Private Mode. The CLI does not save content, but **your input file and terminal scrollback do**. Delete or manage them yourself. Do not use `tee` or output redirection if you do not want a saved result.

## Endpoints and scope

| Method/path | Capability |
|---|---|
| `GET /api/demo/access` | Validate token without paid calls |
| `POST /api/demo/search` | Standard search; streamed NDJSON |
| `POST /api/demo/private-search` | Private search; JSON result and privacy receipt |

Send `Authorization: Bearer <issued token>`. Tokens are rejected on normal history, saved-listing, continuation, and image endpoints. Normal Supabase login tokens retain their ordinary account permissions. The dedicated account is subject to the same SQL admission limits as other accounts: five searches/hour, one active search, global 30/hour. A private request also uses the global private-voyage lock.

## Maintainer: issue a token

The issuer uses your existing **server-side** Supabase environment. It creates an isolated demo auth user, then writes private files (mode 0600) into ignored `.demo-access/<timestamp>/`:

```bash
npm run demo:issue
```

- `server.json`: SHA-256 token hash, dedicated user ID, and expiry timestamp.
- `client.env`: backend URL and the raw client token. Share this file privately.

Set `DUCK_SALE_DEMO_ACCESS` on the server to the exact contents of `server.json`, then deploy. Do not prefix this variable with `NEXT_PUBLIC_`. Only one demo capability is active per deployment configuration; issuing a file does not activate it. Rotating the deployed configuration replaces the previous capability.

The token contains **256 random bits**, is checked with constant-time digest comparison, and expires after **24 hours** by default. Arbitrary strings and “16-bit keys” are not accepted: a public paid backend needs a real access boundary.

## Revoke and clean up

Remove `DUCK_SALE_DEMO_ACCESS` and redeploy, or replace it with a new issued configuration. The current token also stops working at expiry. In-flight requests may finish. Old immutable deployments retain their environment snapshots until expiry; protect/remove those deployments if immediate revocation everywhere is required.

The isolated demo user and standard-mode search rows remain after token expiry. After any in-flight work finishes, remove the demo user through Supabase if those records are no longer needed; review cascading data deletion first. Never delete real user accounts as demo cleanup.

Never commit either credential file, put the raw token in a README, or give clients a provider/service-role key. A token is permission to spend the bounded demo allowance, so distribute it deliberately.
