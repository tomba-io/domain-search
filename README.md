# Tomba Domain Search

[![Price](https://img.shields.io/badge/Price-%240.00312%20per%2010%20results-brightgreen)](#pricing)
[![No signup](https://img.shields.io/badge/Tomba%20account-not%20needed-blue)](#quick-start)
[![No rate limit](https://img.shields.io/badge/Rate%20limit-none-brightgreen)](#built-for-big-lists)

**Find the verified email addresses of the people behind any company website.** Paste a list of domains or company names and get the professional emails Tomba knows for each company, with names, job titles, departments, LinkedIn profiles, verification status, mobile phone numbers on demand and a full company profile, ready to export.

No Tomba account. No API key. No subscription. **You pay $0.00312 for every 10 results you request, plus $0.0156 for each address that comes with phone data when you ask for mobile numbers, and only when we find the company.**

## Why teams choose this Actor

- **Start in 30 seconds**: Open the Actor, paste your domains or company names, click Start. Nothing to sign up for
- **No domain? No problem**: Search by company name (`Stripe`) and Tomba finds the website for you
- **Mobile numbers on demand**: Turn on `enrichMobile` to get each person's phone numbers next to their email
- **Pay only for results**: Unknown domains, errors and invalid inputs are free
- **$0.312 per 1,000 emails**: One credit ($0.00312) covers 10 requested results. No monthly plan, no credits that expire
- **Verified contacts, not guesses**: Every email comes with its verification status, a confidence score and the public sources where it was found
- **Target the right people**: Filter by department (sales, engineering, marketing, executive and 18 more) and by country
- **Built for big lists**: No rate limit. Thousands of domains run in parallel
- **Never pay twice**: Pages you fetched in the last 24 hours come back from cache for free
- **Export anywhere**: Download as CSV, Excel or JSON, or send results straight to your CRM with Apify integrations

## Promises we actually keep

- **Less than 5% bounce rate** — Every email is verified in real time before you're charged.
- **Highest coverage on the market** — 81% email coverage. That's 2x more valid emails than the next best competitor. We find contacts others simply can't.

## What you can do with it

| Goal                        | How Domain Search helps                                                         |
| --------------------------- | ------------------------------------------------------------------------------- |
| **Build prospect lists**    | Turn a list of target accounts into named contacts with verified emails         |
| **Reach decision-makers**   | Filter by department to get only executives, sales or engineering leaders       |
| **Account-based marketing** | Map the team at each target account before your campaign starts                 |
| **Recruit talent**          | Find engineers, designers or sales people at the companies you hire from        |
| **Enrich your CRM**         | Add contacts, titles, LinkedIn profiles and company details to existing records |
| **Call, not just email**    | Add mobile numbers to your prospect list with one checkbox                      |

## Quick start

1. Click **Try for free**
2. Paste your domains into **Domains** (for example `stripe.com`, `tomba.io`), or company names into **Company names** (for example `Stripe`)
3. Click **Start**, then download your results as CSV, Excel or JSON

That's it. No Tomba account or API key is needed.

## Input

| Field                | Required | Default | Description                                                                         |
| -------------------- | -------- | ------- | ----------------------------------------------------------------------------------- |
| `domains`            | Yes\*    |         | Company domains to search. URLs like `https://www.stripe.com/jobs` are cleaned up   |
| `companies`          | Yes\*    |         | Company names to search instead of a domain, e.g. `Stripe`                          |
| `maxEmailsPerDomain` | No       | `10`    | Maximum number of emails to return per domain (1–100)                               |
| `limit`              | No       | `"10"`  | Emails per page request: `"10"`, `"20"` or `"50"`. Costs 1, 2 or 5 credits per page |
| `department`         | No       |         | Only return people from one department, e.g. `sales`, `engineering`, `executive`    |
| `country`            | No       |         | Only return people from one country, as a two-letter code, e.g. `US`                |
| `page`               | No       | `1`     | First page to fetch. Use it to continue a list you already started                  |
| `enrichMobile`       | No       | `false` | Also return each person's phone numbers. +5 credits per address with phone data     |
| `webhookUrl`         | No       |         | A URL (`http://` or `https://`) Tomba also sends every search result to             |
| `includeCompanyInfo` | No       | `true`  | Include the company profile (`organization`) in each result                         |
| `maxConcurrency`     | No       | `10`    | How many domains to process at the same time (1–50)                                 |
| `maxRetries`         | No       | `3`     | How many times to retry a temporary failure (0–10)                                  |
| `useCache`           | No       | `true`  | Reuse results from your previous runs for free                                      |
| `cacheTtlHours`      | No       | `24`    | How long cached results stay valid (`0` turns the cache off)                        |

\* Provide `domains`, `companies` or both. Each domain and each company name is one search.

Available departments: `accounting`, `administrative`, `communication`, `diversity`, `education`, `engineering`, `executive`, `facilities`, `finance`, `healthcare`, `hr`, `it`, `legal`, `management`, `marketing`, `operations`, `pr`, `sales`, `security`, `software`, `support`, `warehouse`.

```json
{
    "domains": ["stripe.com", "shopify.com"],
    "companies": ["Tomba"],
    "maxEmailsPerDomain": 50,
    "limit": "50",
    "department": "sales",
    "country": "US",
    "enrichMobile": true
}
```

## Output

You get one row per domain or company name, with the company profile and the list of emails found:

```json
{
    "domain": "stripe.com",
    "organization": {
        "website_url": "stripe.com",
        "organization": "Stripe",
        "location": {
            "country": "US",
            "city": "San Francisco",
            "state": "California",
            "street_address": "354 Oyster Point Blvd",
            "postal_code": "94080"
        },
        "social_links": {
            "twitter_url": "https://twitter.com/stripe",
            "linkedin_url": "https://www.linkedin.com/company/stripe"
        },
        "phone_number": "+1 415 298 5539",
        "industries": "Information Technology and Services",
        "founded": "2010",
        "company_size": "5K-10K",
        "company_type": "privately held",
        "revenue": "$100M-$250M",
        "description": "Stripe is a payment processing platform enabling businesses to accept payments online."
    },
    "emails": [
        {
            "email": "jane@stripe.com",
            "first_name": "Jane",
            "last_name": "Natoli",
            "full_name": "Jane Natoli",
            "position": "Financial Crimes Analyst",
            "department": "finance",
            "seniority": "senior",
            "type": "personal",
            "country": "US",
            "linkedin": "https://www.linkedin.com/in/janenatoli",
            "phone_number": true,
            "phone_data": [{ "number": "+14155550123", "type": "mobile" }],
            "score": 99,
            "verification": { "date": "2025-09-13T00:00:00+02:00", "status": "valid" },
            "sources": [
                {
                    "uri": "https://stripe.com/about",
                    "extracted_on": "2024-01-01T00:00:00+02:00",
                    "last_seen_on": "2025-09-01T00:00:00+02:00",
                    "still_on_page": true
                }
            ]
        }
    ],
    "phoneNumbers": 1,
    "meta": { "total": 1250, "pageSize": 10, "current": 1, "total_pages": 125 },
    "pages": 1,
    "chargedRequests": 1,
    "chargedCredits": 6,
    "charged": true,
    "cached": false
}
```

| Field                 | Description                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `company`             | The company name you submitted (company searches only)                                                                       |
| `domain`              | The domain you submitted (cleaned up). For a company name: the company's domain, when Tomba reports it                       |
| `organization`        | Company profile: name, description, industry, size, revenue, founding year, address, phone and social links                  |
| `emails`              | The emails found. Each one has the name, position, department, seniority, country, LinkedIn, score, verification and sources |
| `emails[].phone_data` | The person's phone numbers (only with `enrichMobile`)                                                                        |
| `phoneNumbers`        | How many phone numbers were returned across all emails (only with `enrichMobile`)                                            |
| `meta`                | Paging information, including `total`: how many emails Tomba knows for this domain with your filters                         |
| `pages`               | How many pages of results were fetched for this domain                                                                       |
| `chargedRequests`     | How many of those pages were billed                                                                                          |
| `chargedCredits`      | Credits billed for this search ($0.00312 each)                                                                               |
| `charged`             | `true` if at least one page was billed for this domain                                                                       |
| `cached`              | `true` if every page came from the cache (free)                                                                              |
| `error`               | Why no results were returned, if applicable                                                                                  |

The dataset has three ready-made views: **Domain Search Results**, **Individual Emails** and **Company Information**.

## Pricing

**One credit costs $0.00312.** No subscription and no Tomba account needed.

Each page of results costs:

- **1 credit per 10 results requested** with `limit`, rounded up. The default `limit` of 10 costs 1 credit, 20 costs 2 and 50 costs 5
- **plus 5 credits ($0.0156) for each returned address that has phone data**, only when you turn on `enrichMobile`. Without it, you never pay for phone data

| Page                                                         | Credits        | Cost     |
| ------------------------------------------------------------ | -------------- | -------- |
| `limit: "10"` (default)                                      | 1              | $0.00312 |
| `limit: "20"`                                                | 2              | $0.00624 |
| `limit: "50"`                                                | 5              | $0.0156  |
| `limit: "10"` + `enrichMobile`, 3 addresses with phone data  | 1 + 3 × 5 = 16 | $0.04992 |
| `limit: "10"` + `enrichMobile`, no addresses with phone data | 1              | $0.00312 |

The Actor fetches pages one after another until it reaches `maxEmailsPerDomain` or runs out of emails. A domain with fewer emails than `maxEmailsPerDomain` needs fewer pages and costs less. A search by company name costs exactly the same as a search by domain.

You are only charged when Tomba returns a usable answer:

| What happens                                                 | Charged                                                        |
| ------------------------------------------------------------ | -------------------------------------------------------------- |
| A page of emails is returned                                 | Yes: the page credits (plus phone credits with `enrichMobile`) |
| The company is found but has no emails matching your filters | Yes: the page credits only                                     |
| The domain is unknown to Tomba                               | No                                                             |
| Invalid domain or any other error                            | No                                                             |
| Temporary failure (it is retried automatically)              | No                                                             |
| Result served from the cache                                 | No                                                             |

Every row shows `pages`, `chargedRequests`, `chargedCredits`, `charged` and `cached`, so you always know what you paid for. To cap your spend, set **Maximum cost per run** in the run options: the Actor stops cleanly when the limit is reached.

## Built for big lists

- **No rate limit**: up to 50 domains are processed at the same time
- **Automatic paging**: the Actor fetches as many pages as needed to reach your `maxEmailsPerDomain`
- **Automatic retries**: temporary failures are retried for you, and never billed
- **Resumable**: if a run is interrupted, it continues where it stopped without charging you again
- **Cache**: repeat lookups within 24 hours are free

## Integrations

Run it on a schedule, call it from the Apify API, or connect it to Zapier, Make, Google Sheets, HubSpot, Slack and hundreds of other apps with [Apify integrations](https://docs.apify.com/platform/integrations). Webhooks let you trigger your own workflow as soon as a run finishes.

## FAQ

**Do I need a Tomba account or API key?**
No. Everything is built in. You only pay for the credits you use on Apify.

**How much does it cost?**
1 credit ($0.00312) per 10 results requested with `limit`, rounded up, so the default `limit` of 10 costs 1 credit. If you turn on `enrichMobile`, add 5 credits ($0.0156) for each returned address with phone data. Unknown domains, errors and cached lookups are free.

**Can I get phone numbers too?**
Yes. Turn on `enrichMobile` and every email that has a known phone number comes with a `phone_data` list, and each row shows the total in `phoneNumbers`. You pay 5 extra credits ($0.0156) only for addresses that actually come back with phone data.

**I only have company names, not domains. Does it work?**
Yes. Put them in `companies` (for example `Stripe`) and Tomba finds the company's domain for you. You can mix `domains` and `companies` in the same run.

**Can results be pushed to my own system?**
Yes. Set `webhookUrl` and Tomba also sends each search result to that URL. You can also use Apify integrations and webhooks to react when the run finishes.

**How many emails can I get per company?**
Up to 100 per domain with `maxEmailsPerDomain`. The `meta.total` field tells you how many emails Tomba knows for that company.

**Why was I charged for a company with no emails?**
Tomba found the company and returned its profile, but no emails matched your filters. That is still a real answer, so it counts as one page. Domains Tomba doesn't know at all are free.

**Can I target a specific team?**
Yes. Use `department` (for example `sales`, `marketing` or `executive`) and `country` (for example `US`) to get only the people you want to reach.

**What domain format should I use?**
Anything works: `stripe.com`, `www.stripe.com` or `https://stripe.com/jobs`. We clean it up and remove duplicates. Company names are trimmed and deduplicated too.

**How many domains can I search in one run?**
As many as you like. Domains are processed in parallel and there is no rate limit.

**What if my run is interrupted?**
It picks up where it stopped. Domains already processed are not charged again.

**How do I limit what I spend?**
Set **Maximum cost per run** before you start. The Actor stops as soon as the limit is reached.

**Is the data GDPR compliant?**
Tomba only collects publicly available professional information and follows GDPR guidelines.

## Support

Questions or feedback? We're happy to help:

- **Email**: support@tomba.io
- **Live chat**: on [tomba.io](https://tomba.io) during business hours
- **Issues**: use the **Issues** tab on this Actor's page

## About Tomba

Founded in 2020, [Tomba](https://tomba.io) is a B2B data platform for finding, verifying and enriching business contacts. Our Email Finder, Domain Search and Email Verifier help sales and marketing teams reach the right people.

![Tomba Logo](https://tomba.io/logo.png)
