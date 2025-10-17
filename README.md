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

The Actor outputs an array of email results with the following structure:

```json
{
    "domain": "example.com",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "position": "Software Engineer",
    "companyName": "Example Corp",
    "sources": [
        {
            "uri": "https://example.com/about",
            "website_url": "https://example.com",
            "extracted_on": "2023-01-01T00:00:00Z",
            "last_seen_on": "2023-01-01T00:00:00Z"
        }
    ],
    "verification": {
        "date": "2023-01-01T00:00:00Z",
        "status": "valid"
    }
}
```

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
