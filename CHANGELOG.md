# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## 1.0.0 (2026-10-07)

### ⚠ BREAKING CHANGES

- `tombaApiKey` and `tombaApiSecret` inputs were removed. The Actor now uses built-in Tomba credentials from the `TOMBA_API_KEY` / `TOMBA_API_SECRET` environment variables, so users no longer need a Tomba account.
- One dataset item per domain now includes `domain` and the search `meta`; domains without a result are saved with an `error` field.

### Features

- Pay-per-event pricing in credits of $0.00312 (`tomba-request`): 1 credit per 10 results requested with `limit` (rounded up) per page, plus 5 credits per returned address with phone data (a non-empty `phone_data`, only with `enrichMobile`; the `phone_number` flag alone is never charged); errors, empty results and cache hits are free
- Each item includes `chargedCredits`
- `companies` input: search by company name (sent as `company`) as an alternative to `domains`; at least one of the two is required. Company items include `company` and, when Tomba reports it, the resolved `domain`
- `enrichMobile` input: sends `enrich_mobile=true` so each email carries its phone numbers in `phone_data` (+5 credits per returned address with phone data)
- `webhookUrl` input: sent as `webhook_url`; Tomba also POSTs the result there
- `department` now also accepts `education` and `healthcare`
- Each item includes `phoneNumbers` (total phone numbers returned)
- Automatic paging until `maxEmailsPerDomain` is reached or there are no more results (each page is charged once)
- No client-side rate limit (removed the 1-second delay); parallel processing with `maxConcurrency`
- Automatic retries with exponential backoff for network errors, 429 and 5xx (`maxRetries`)
- Cross-run result cache (`useCache`, `cacheTtlHours`)
- Resume after migration or restart
- Domains are normalized and deduplicated
- Each dataset item now includes `charged`, `cached`, `pages` and `chargedRequests`
- Standby mode: real-time HTTP API (`GET /?domain=…` or `POST /` with the run input) with an OpenAPI web server schema
- Key-value store schema for `INPUT`, `TOMBA_STATE` and `SUMMARY`
- 256 MB default memory

### Dependencies

- `tomba` upgraded to 1.1.1 (responses are now `{ data, rateLimit }`)
- `apify` upgraded to 3.7.2

### 0.0.2 (2025-10-20)
