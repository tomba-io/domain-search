# Development

Notes for maintainers of the Tomba Domain Search Actor. The README is the end-user page shown on Apify Store; [USAGE.md](USAGE.md) covers running the Actor locally and troubleshooting.

## Requirements

- Node.js 20+
- [Apify CLI](https://docs.apify.com/cli) for deployment

## Scripts

```bash
npm install
npm run build     # compile TypeScript to dist/
npm run lint      # ESLint (src and test)
npm run format    # Prettier
npm test          # unit + end-to-end tests (node:test)
npm start         # run locally with tsx
```

## Credentials

The Actor uses our Tomba account. Credentials come from environment variables, never from the input:

| Variable             | Description                                        |
| -------------------- | -------------------------------------------------- |
| `TOMBA_API_KEY`      | Tomba API key (`ta_…`)                             |
| `TOMBA_API_SECRET`   | Tomba secret (`ts_…`)                              |
| `TOMBA_API_ENDPOINT` | Optional API base URL; only used by the test suite |

`.actor/actor.json` maps the variables to Apify secrets:

```bash
apify secrets add tombaApiKey ta_xxxxxxxxxxxxxxxxxxxx
apify secrets add tombaApiSecret ts_xxxxxxxxxxxxxxxxxxxx
apify push
```

Run locally:

```bash
TOMBA_API_KEY=ta_… TOMBA_API_SECRET=ts_… npm start
```

If the variables are missing the run fails with "Actor is misconfigured" before any request is made.

## Pricing (pay per event)

In **Apify Console → Publication → Monetization**, choose **Pay per event** and add:

| Event           | Price    | Charged when                                                 |
| --------------- | -------- | ------------------------------------------------------------ |
| `tomba-request` | $0.00312 | Once per credit of a billable Domain Search page (see below) |

Domain Search costs credits, charged as `tomba-request` events with `count`:

- `ceil(limit / 10)` credits per page (limit 10 = 1, 20 = 2, 50 = 5)
- plus `PHONE_CREDITS` (5) credits per returned address with phone data, only when `enrichMobile` is on: an address whose `phone_data` array is non-empty (`hasPhoneData()` in `src/tomba.ts`). The `emails[].phone_number` boolean is only Tomba's "has a phone" flag and is never billed

`domainSearchCredits()` in `src/main.ts` computes this from the whole returned page (even if fewer addresses are kept because of `maxEmailsPerDomain`) and passes it to `callTomba()` as the charge count. Each page is a separate Tomba request and is charged on its own; the item's `chargedCredits` is the sum.

`isBillable()` in `src/tomba.ts` mirrors Tomba's billing:

| Tomba outcome                                                          | Charged |
| ---------------------------------------------------------------------- | ------- |
| JSON with non-empty `data`, including an organization with zero emails | Yes     |
| Error status (4xx, 5xx, including 422 and 429)                         | No      |
| Success with empty or null `data`                                      | No      |
| Success with an `errors` object                                        | No      |
| Non-JSON body (reported as 502)                                        | No      |
| Cache hit                                                              | No      |

There is no client-side rate limit; throughput is controlled by `maxConcurrency`.

## Architecture

- `src/tomba.ts`: shared helper, identical in every Tomba Actor. It handles credentials, caching (per-Actor `tomba-cache-<actorId>` key-value store; falls back to an in-run cache if it can't be opened), retries with exponential backoff, pay-per-event charging, budget reservation, the concurrency pool and resume state.
- `src/main.ts`: input handling, paging and output mapping.
    - Input is `domains` and/or `companies` (at least one required; the run fails before any request otherwise). Domains are normalized (`normalizeDomain`) and deduplicated; company names are trimmed (inner whitespace collapsed) and deduplicated case-insensitively. A domain is sent as `domain=`, a company name as `company=`.
    - Resume-state keys are the plain domain for domains and `company:<lowercased name>` for companies; cache keys differ automatically because the request params differ (`domain` vs `company`).
    - Optional query parameters: `department`, `country`, `enrich_mobile=true` (only when `enrichMobile` is on) and `webhook_url` (from `webhookUrl`, must start with `http://` or `https://`). `education` and `healthcare` departments are not in the SDK type but are accepted by the API, so the params are cast.
    - Searches run in parallel (`runPool`); the pages of one search run sequentially, starting at `page`.
    - Paging stops when `maxEmailsPerDomain` is reached, at a short page, at `meta.total_pages`, when `meta.total` emails were collected, at a non-billable page, or when the charge limit is reached (the domain keeps the pages already fetched).
    - If the charge limit is reached before the first page of a domain, the domain is not marked done, so a resumed run processes it.
    - One dataset item per search: `domain` or `company` (+ `domain` from `meta.params.domain` / `organization.website_url` when Tomba reports it), `organization` (if `includeCompanyInfo`), `emails` (passed through, so `phone_data` is included with `enrichMobile`), `phoneNumbers` (sum of `phone_data` lengths), `meta` (of the last page), `pages`, `chargedRequests`, `chargedCredits`, `charged`, `cached`; failures are `{ domain | company, charged: false, cached: false, error }`.
    - A `SUMMARY` record is written to the default key-value store (batch runs only).
    - `outputFormat` is accepted for backwards compatibility but does not change the output.
- The `tomba` SDK v1.1.1 resolves every call to `{ data, rateLimit }`, where `data` is the response body. Its `.d.ts` types still declare the old return type, so always go through `callTomba()`.

## Tests

- `test/tomba.test.ts`: unit tests for the shared helper (identical in every Actor)
- `test/main.test.ts`: end-to-end tests that run `src/main.ts` against a local mock Tomba API (paging, billing incl. phone credits, `companies`, `enrich_mobile` / `webhook_url`, cache, retries, charge limit and resume, concurrency, credentials, Standby HTTP API). The mock adds `phone_data` only when the request has `enrich_mobile=true` (every third address gets one number)
- `test/helpers.ts`: mock server and Actor runner (identical in every Actor)

Locally, the Apify SDK prices every event at $1 when `ACTOR_TEST_PAY_PER_EVENT=true`, so the tests use `maxTotalChargeUsd` as an event count.

## Standby mode (real-time API)

`.actor/actor.json` sets `usesStandbyMode: true` and `webServerSchema: ./web_server_schema.json` (OpenAPI 3).

- `src/standby.ts` (shared, identical in every Actor): `runActor()` runs a batch job, or, when `APIFY_META_ORIGIN=STANDBY`, starts an HTTP server on `Actor.config.get('containerPort')`.
    - `GET /` with the `x-apify-container-server-readiness-probe` header, or with no query: readiness / usage.
    - `GET /?…`: input built by `fromQuery()` in `src/main.ts` (`domain`/`domains`, `company`/`companies` as repeated or comma-separated values, `maxEmailsPerDomain`, `includeCompanyInfo`, `page`, `limit`, `department`, `country`, `enrichMobile`, `webhookUrl`).
    - `POST /`: the same JSON input as a batch run.
    - Responses: `200 { items }`, `400` invalid input (`InputError`), `402` max charge limit reached, `404`, `405`.
- `run(input, ctx)` is shared by both modes: `ctx.push()` writes to the dataset in batch runs and to the HTTP response in Standby; `ctx.isDone()`/`ctx.markDone()` persist resume state only in batch runs. The `SUMMARY` record is only written in batch runs.
- Caching and pay-per-event charging work the same in both modes.

Try it locally:

```bash
APIFY_META_ORIGIN=STANDBY ACTOR_WEB_SERVER_PORT=8080 TOMBA_API_KEY=ta_… TOMBA_API_SECRET=ts_… npm start
curl "localhost:8080/?domain=stripe.com"
```

## Key-value store schema

`.actor/key_value_store_schema.json` documents the default key-value store records (`INPUT`, `TOMBA_STATE`, `SUMMARY`). The cross-run cache lives in the separate named store `tomba-cache-<actorId>`, one per Actor: under limited permissions an Actor can only open named storages it created itself, so the Tomba Actors must not share one store. If the store can't be opened, the run logs a warning and caches for this run only.

## Memory

`defaultMemoryMbytes` is 256: the Actor only makes HTTP calls, so more memory just costs more.

## Deployment

```bash
apify login
apify push
```

Or link the Git repository from the [Actor creation page](https://console.apify.com/actors/new).

## License

ISC
