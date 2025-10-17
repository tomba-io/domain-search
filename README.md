# Tomba Domain Search Actor

An Apify Actor that uses the Tomba API to find email addresses associated with domains. This Actor specializes in domain-wide email discovery to help you find contact information for any domain.

## Features

- 🔍 **Domain Search**: Find all email addresses associated with a domain
- 🎯 **Advanced Filtering**: Filter by department, country, and pagination support
- 📈 **Flexible Limits**: Choose between 10, 20, or 50 results per domain
- 🏢 **Company Information**: Optionally include company details
- ⚡ **Rate Limiting**: Built-in delays to respect API limits (15 requests/second max)
- 📊 **Comprehensive Results**: Detailed email information including verification status and sources
- 🛡️ **Error Handling**: Robust error handling with detailed logging
- 🚀 **High Performance**: Efficient processing of multiple domains with automatic rate managementl Finder Actor

## Input

The Actor accepts the following input parameters:

### Required Parameters

- **Tomba API Key** (`tombaApiKey`): Your Tomba API key (starts with 'ta\_')
- **Tomba API Secret** (`tombaApiSecret`): Your Tomba API secret (starts with 'ts\_')
- **Domains** (`domains`): Array of domains to search for email addresses

### Optional Parameters

- **Email Finding Mode** (`emailFindingMode`): Search mode (currently only "domain" is supported)
- **Max Emails Per Domain** (`maxEmailsPerDomain`): Maximum emails to find per domain (1-100, default: 10)
- **Include Company Info** (`includeCompanyInfo`): Include company information when available (default: true)
- **Output Format** (`outputFormat`): Data format - `detailed` or `simple` (default: detailed)

### Domain Search Query Parameters

- **Page** (`page`): Page number for pagination (default: 1)
- **Limit** (`limit`): Max number of email addresses to return per domain
    - Options: `"10"`, `"20"`, `"50"` (default: `"10"`)
- **Department** (`department`): Filter emails by department
    - Options: `engineering`, `sales`, `finance`, `hr`, `it`, `marketing`, `operations`, `management`, `executive`, `legal`, `support`, `communication`, `software`, `security`, `pr`, `warehouse`, `diversity`, `administrative`, `facilities`, `accounting`
- **Country** (`country`): Two-letter country code filter (e.g., "US", "UK", "CA")

### Example Input

```json
{
    "tombaApiKey": "ta_xxxx",
    "tombaApiSecret": "ts_xxxx",
    "domains": ["stripe.com", "google.com"],
    "emailFindingMode": "domain",
    "maxEmailsPerDomain": 10,
    "includeCompanyInfo": true,
    "outputFormat": "detailed",
    "page": 1,
    "limit": "20",
    "department": "engineering",
    "country": "US"
}
```

## Output

The Actor provides three comprehensive data views for analyzing email and company information:

### Overview View - Domain Search Results

Complete overview of email addresses found for each domain with full company information:

```json
{
    "domain": "stripe.com",
    "organization.website_url": "stripe.com",
    "organization.organization": "Stripe",
    "organization.location.country": "US",
    "organization.location.city": "San Francisco",
    "organization.location.state": "California",
    "organization.industries": "Information Technology and Services",
    "organization.founded": "2010",
    "organization.company_size": "5K-10K",
    "organization.company_type": "privately held",
    "organization.revenue": "$100M-$250M",
    "organization.phone_number": "+1 415 298 5539",
    "organization.description": "stripe is a payment processing platform...",
    "organization.social_links.linkedin_url": "https://www.linkedin.com/company/stripe",
    "organization.social_links.twitter_url": "https://twitter.com/stripe",
    "emails": [
        {
            "email": "jane@stripe.com",
            "first_name": "Jane",
            "last_name": "Natoli",
            "position": "Financial Crimes Analyst",
            "department": "finance",
            "verification": {
                "status": "valid",
                "date": "2025-09-13T00:00:00+02:00"
            }
        }
    ],
    "meta.total": 20,
    "meta.params": {}
}
```

### Individual Emails View - Detailed Email Information

Flattened view showing each email address with personal and professional details:

```json
{
    "domain": "stripe.com",
    "organization.organization": "Stripe",
    "organization.location.country": "US",
    "organization.industries": "Information Technology and Services",
    "email": "jane@stripe.com",
    "first_name": "Jane",
    "last_name": "Natoli",
    "full_name": "Jane Natoli",
    "position": "Financial Crimes Analyst",
    "department": "finance",
    "seniority": "senior",
    "type": "personal",
    "country": "US",
    "linkedin": "https://www.linkedin.com/in/jane-natoli-52a8a0a",
    "score": 100,
    "verification.status": "valid",
    "verification.date": "2025-09-13T00:00:00+02:00",
    "sources": [
        {
            "uri": "https://stripe.com/docs/cli",
            "website_url": "stripe.com",
            "extracted_on": "2022-03-08T01:23:16+01:00",
            "last_seen_on": "2022-08-04T09:42:10+02:00",
            "still_on_page": true
        }
    ]
}
```

### Company Information View - Business Intelligence

Comprehensive company profiles with all available business data:

```json
{
    "domain": "stripe.com",
    "organization.website_url": "stripe.com",
    "organization.organization": "Stripe",
    "organization.description": "stripe is a payment processing platform enabling businesses to accept payments and manage online transactions.",
    "organization.industries": "Information Technology and Services",
    "organization.founded": "2010",
    "organization.company_size": "5K-10K",
    "organization.company_type": "privately held",
    "organization.revenue": "$100M-$250M",
    "organization.location.country": "US",
    "organization.location.city": "San Francisco",
    "organization.location.state": "California",
    "organization.location.street_address": "354 oyster point blvd",
    "organization.location.postal_code": "94107",
    "organization.phone_number": "+1 415 298 5539",
    "organization.social_links.linkedin_url": "https://www.linkedin.com/company/stripe",
    "organization.social_links.twitter_url": "https://twitter.com/stripe",
    "organization.social_links.facebook_url": "https://www.facebook.com/stripehq",
    "organization.whois.registrar_name": "safenames ltd.",
    "organization.whois.created_date": "1995-09-12T06:00:00+02:00"
}
```

### Key Data Fields

**Email Information:**

- `email`: Email address
- `first_name`, `last_name`, `full_name`: Personal names
- `position`: Job title
- `department`: Department (engineering, sales, finance, etc.)
- `seniority`: Job level (senior, junior, executive, etc.)
- `type`: Email type (personal, generic, etc.)
- `country`: Person's country
- `linkedin`: LinkedIn profile URL
- `score`: Confidence score (0-100)
- `verification.status`: Email validity (valid, invalid, risky, etc.)
- `verification.date`: When email was last verified

**Company Information:**

- `organization.organization`: Company name
- `organization.description`: Business description
- `organization.industries`: Industry classification
- `organization.founded`: Year established
- `organization.company_size`: Employee count range
- `organization.company_type`: Business type (privately held, public, etc.)
- `organization.revenue`: Revenue range
- `organization.location.*`: Full address details
- `organization.social_links.*`: Social media profiles
- `organization.whois.*`: Domain registration details

**Source Information:**

- `sources`: Array of where emails were found
    - `uri`: Specific webpage URL
    - `website_url`: Main website
    - `extracted_on`: Discovery date
    - `last_seen_on`: Last verification date
    - `still_on_page`: Current availability status

## Getting Started

1. **Get Tomba API Credentials**: Sign up at [Tomba.io](https://tomba.io) and obtain your API key and secret
2. **Configure Input**: Set up your input with the required API credentials and domains
3. **Run the Actor**: The Actor will process each domain and return email results

## API Rate Limits

### Domain Search Rate Limits

- **15 requests per second** - The Tomba API allows up to 15 domain search requests per second
- **Built-in Rate Limiting**: This Actor includes a 1-second delay between domain requests to respect API limits and ensure stable operation
- **Efficient Management**: The rate limiting ensures you can manage your searches efficiently without exceeding platform constraints

### Rate Limit Management

The Actor automatically handles rate limiting by:

- Adding 1-second delays between each domain search
- Preventing API rate limit errors
- Ensuring consistent and reliable email discovery
- Allowing for high-volume usage within API constraints

For high-volume usage, consider the rate limits of your Tomba plan and the number of domains you process per run.

## Error Handling

The Actor handles various error scenarios:

- Invalid API credentials
- Missing required parameters
- API rate limit errors
- Network timeouts
- Invalid domain formats

Errors are logged and included in the output for transparency.

## Use Cases

- **Lead Generation**: Find contact emails for potential customers
- **Market Research**: Analyze email patterns across competitors
- **Recruitment**: Find contact information for potential candidates
- **Sales Outreach**: Build targeted email lists for specific companies
- **Data Enrichment**: Enhance existing contact databases
