# Usage Guide (maintainers)

How to run the Tomba Domain Search Actor locally and what to check when something goes wrong. See [Development.md](Development.md) for credentials, pricing and architecture, and the README for the end-user documentation.

## Run locally

1. Put an input in `storage/key_value_stores/default/INPUT.json` (no Tomba credentials in the input):

    ```json
    {
        "domains": ["stripe.com"],
        "maxEmailsPerDomain": 20,
        "limit": "10"
    }
    ```

2. Run the Actor with the Tomba credentials in the environment:

    ```bash
    TOMBA_API_KEY=ta_xxx TOMBA_API_SECRET=ts_xxx npm start
    ```

On the Apify platform the credentials come from the `tombaApiKey` / `tombaApiSecret` Apify secrets (see `.actor/actor.json`), so users never provide them.

## Input

- `domains`: domains to search; normalized and deduplicated
- `companies`: company names to search (sent as `company=`); trimmed and deduplicated. At least one of `domains` / `companies` is required
- `maxEmailsPerDomain` (default 10, max 100): the Actor pages automatically to reach it
- `limit` (`"10"`, `"20"` or `"50"`, default `"10"`): emails per page request; every billable page costs `ceil(limit / 10)` `tomba-request` events plus, with `enrichMobile`, 5 per returned address with non-empty `phone_data`
- `page` (default 1): first page to fetch
- `department`, `country`: Tomba filters, passed through as query parameters
- `enrichMobile` (default false): sends `enrich_mobile=true`; emails then carry `phone_data`
- `webhookUrl`: sent as `webhook_url`; Tomba also POSTs the result there (not for cached pages)
- `includeCompanyInfo` (default true): include `organization` in the output
- `outputFormat`: accepted but currently has no effect
- `maxConcurrency` (default 10), `maxRetries` (default 3), `useCache` / `cacheTtlHours` (default on, 24 hours)

## Output

One dataset item per domain or company name (company searches have `company` and, when Tomba reports it, `domain`):

```json
{
    "domain": "stripe.com",
    "organization": { "organization": "Stripe", "...": "..." },
    "emails": [{ "email": "jane@stripe.com", "first_name": "Jane", "phone_data": [], "...": "..." }],
    "phoneNumbers": 0,
    "meta": { "total": 1250, "pageSize": 10, "current": 2, "total_pages": 125 },
    "pages": 2,
    "chargedRequests": 2,
    "chargedCredits": 2,
    "charged": true,
    "cached": false
}
```

A search without results is saved as `{ "domain" | "company", "charged": false, "cached": false, "error" }`.

## Error handling

- **Missing credentials**: the run fails with "Actor is misconfigured" when `TOMBA_API_KEY` / `TOMBA_API_SECRET` are not set; no request is made
- **Network errors, 429 and 5xx**: retried with exponential backoff (`maxRetries`), never charged
- **Invalid domains or filters (4xx)**: saved as an item with an `error` field and `charged: false`, not retried
- **A later page fails**: the domain keeps the pages already fetched
- **Max cost per run reached**: the Actor stops cleanly; a resumed run skips finished domains

## Troubleshooting

### Authentication errors

```
Error: Please enter a valid KEY
```

- Check the `TOMBA_API_KEY` / `TOMBA_API_SECRET` environment variables (or the Apify secrets they map to)
- Check the Tomba account status of those credentials

### No results

- The domain may not have indexed emails, or the `department` / `country` filters are too narrow
- Check that the domain is spelled correctly

### Slow runs

- Raise `maxConcurrency`; there is no client-side rate limit
- Use `limit: "50"` so fewer page requests are needed (the credit cost per result is the same)
- Keep `useCache` on for re-runs
