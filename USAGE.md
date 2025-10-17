# Usage Guide - Tomba Domain Search Actor

## Quick Start

1. **Get Tomba API Credentials**
    - Sign up at [Tomba.io](https://tomba.io)
    - Get your API Key (starts with `ta_`) and Secret (starts with `ts_`)

2. **Update Input Configuration**

    ```json
    {
        "tombaApiKey": "ta_your_actual_key_here",
        "tombaApiSecret": "ts_your_actual_secret_here",
        "domains": ["example.com"]
    }
    ```

3. **Run the Actor**
    ```bash
    apify run
    ```

## Input Parameters

### Required

- `tombaApiKey`: Your Tomba API key
- `tombaApiSecret`: Your Tomba API secret
- `domains`: Array of domains to search

### Optional

- `maxEmailsPerDomain`: Max emails per domain (default: 10)
- `includeCompanyInfo`: Include company details (default: true)
- `firstName`: Required for finder mode
- `lastName`: Required for finder mode

## Search Modes

### Domain Search (`"domain"`)

Finds all email addresses associated with a domain:

```json
{
    "domains": ["stripe.com"]
}
```

## Example Output

```json
{
    "domain": "stripe.com",
    "email": "john@stripe.com",
    "firstName": "John",
    "lastName": "Collison",
    "position": "Co-founder",
    "companyName": "Stripe",
    "sources": [
        {
            "uri": "https://stripe.com/about",
            "website_url": "https://stripe.com",
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

## Local Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run start:dev

# Build for production
npm run build

# Run tests (if available)
npm test

# Fix linting issues
npm run lint:fix
```

## Error Handling

The Actor handles various scenarios:

- **Invalid API credentials**: Logs error and continues with next domain
- **Rate limiting**: Built-in delays to respect API limits
- **Network issues**: Retries and error logging
- **Invalid domains**: Validation and error reporting

## API Rate Limits

- Built-in 1-second delay between domain requests
- Respects Tomba API rate limits
- For high-volume usage, consider your Tomba plan limits

## Troubleshooting

### Authentication Issues

```
Error: Please enter a valid KEY
```

- Verify your API key starts with `ta_`
- Verify your API secret starts with `ts_`
- Check your Tomba account status

### No Results Found

- Domain might not have indexed emails
- Try different domains
- Check if domain is spelled correctly

### Rate Limiting

- Actor includes built-in delays
- Consider upgrading Tomba plan for higher limits
- Reduce number of domains per run
