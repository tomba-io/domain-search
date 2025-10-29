# Tomba Domain Search Actor

[![Actor](https://img.shields.io/badge/Apify-Actor-blue)](https://apify.com/actors)
[![Tomba API](https://img.shields.io/badge/Tomba-API-green)](https://tomba.io)
[![Rate Limit](https://img.shields.io/badge/Rate%20Limit-15%2Fsec-orange)](https://tomba.io/api)

A powerful Apify Actor that uses the **Tomba Domain Search API** to find email addresses associated with company domains. Perfect for sales teams, marketers, and researchers who need to discover contact information and build targeted email lists for lead generation and outreach campaigns.

## Key Features

- **Domain-Wide Email Discovery**: Find all email addresses associated with any company domain
- **Advanced Filtering**: Filter by department, country, seniority, and job roles
- **Comprehensive Contact Data**: Personal details, job titles, verification status, and LinkedIn profiles
- **Company Intelligence**: Business information, location, revenue, and social media profiles
- **Flexible Results**: Choose between 10, 20, or 50 results per domain with pagination support
- **Email Verification**: Real-time email validation and deliverability status
- **Rate Limited**: Respects Tomba's 15 requests per second limit with built-in delays
- **Source Tracking**: Detailed information about where emails were discovered
- **Error Handling**: Robust error handling with detailed logging

## How it works

The Actor leverages Tomba's powerful Domain Search API to discover email addresses and gather comprehensive contact information:

### Process Flow

1. **Authentication**: Connects to Tomba API using your credentials
2. **Domain Processing**: Searches each domain for email addresses with specified filters
3. **Data Enrichment**: Gathers personal details, job information, and verification status
4. **Company Intelligence**: Collects business information and social profiles
5. **Rate Management**: Automatically handles 15 requests/second limit with delays
6. **Data Storage**: Saves results to Apify dataset with multiple view formats

### What You Get

For each domain, you'll receive:

- **Email Discovery**: Complete list of email addresses with personal and professional details
- **Contact Information**: Names, job titles, departments, seniority levels, and LinkedIn profiles
- **Email Verification**: Validation status, confidence scores, and verification dates
- **Company Profiles**: Business details, location, revenue, employee count, and social media
- **Source Intelligence**: Where emails were found, discovery dates, and current availability
- **Industry Insights**: Company classification, founding information, and business type

## Quick Start

### Prerequisites

1. **Tomba Account**: Sign up at [Tomba.io](https://app.tomba.io/api) to get your API credentials

### Getting Your API Keys

1. Visit [Tomba API Dashboard](https://app.tomba.io/api)
2. Copy your **API Key** (starts with `ta_`)
3. Copy your **Secret Key** (starts with `ts_`)

## Input Configuration

### Required Parameters

| Parameter        | Type     | Description                     |
| ---------------- | -------- | ------------------------------- |
| `tombaApiKey`    | `string` | Your Tomba API key (ta_xxxx)    |
| `tombaApiSecret` | `string` | Your Tomba secret key (ts_xxxx) |
| `domains`        | `array`  | Array of domains to search      |

### Optional Parameters

| Parameter            | Type      | Default      | Description                                        |
| -------------------- | --------- | ------------ | -------------------------------------------------- |
| `emailFindingMode`   | `string`  | `"domain"`   | Search mode (currently only "domain" is supported) |
| `maxEmailsPerDomain` | `number`  | `10`         | Maximum emails to find per domain (1-100)          |
| `includeCompanyInfo` | `boolean` | `true`       | Include company information when available         |
| `outputFormat`       | `string`  | `"detailed"` | Data format - `detailed` or `simple`               |
| `page`               | `number`  | `1`          | Page number for pagination                         |
| `limit`              | `string`  | `"10"`       | Max emails per domain (`"10"`, `"20"`, or `"50"`)  |
| `department`         | `string`  | -            | Filter by department (see available options below) |
| `country`            | `string`  | -            | Two-letter country code filter (e.g., "US", "UK")  |

### Department Filter Options

Available department filters: `engineering`, `sales`, `finance`, `hr`, `it`, `marketing`, `operations`, `management`, `executive`, `legal`, `support`, `communication`, `software`, `security`, `pr`, `warehouse`, `diversity`, `administrative`, `facilities`, `accounting`

### Example Input

```json
{
    "tombaApiKey": "ta_xxxxxxxxxxxxxxxxxxxx",
    "tombaApiSecret": "ts_xxxxxxxxxxxxxxxxxxxx",
    "domains": ["stripe.com", "google.com", "tomba.io"],
    "emailFindingMode": "domain",
    "maxEmailsPerDomain": 20,
    "includeCompanyInfo": true,
    "outputFormat": "detailed",
    "page": 1,
    "limit": "20",
    "department": "engineering",
    "country": "US"
}
```

### Best Practices

- **Domain Selection**: Use clean domain names without protocols (http/https)
- **Rate Limits**: The Actor automatically handles Tomba's 15 requests/second limit
- **Batch Size**: Process 5-20 domains at a time for optimal performance
- **Department Filtering**: Use specific departments to target relevant contacts
- **Pagination**: Use page parameter for large result sets

## Output Data Structure

The Actor provides comprehensive email discovery and company intelligence data in three organized views:

### Example Output - Overview View

Complete domain search results with company information and discovered emails:

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
    "organization.description": "stripe is a payment processing platform enabling businesses to accept payments and manage online transactions.",
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

### Data Structure Overview

The output contains three main data categories organized for different use cases:

#### Email Discovery Results

- **Contact Details**: Email addresses, names, job titles, and departments
- **Professional Info**: Position, seniority level, and LinkedIn profiles
- **Verification Data**: Email validity status, confidence scores, and verification dates
- **Source Intelligence**: Where emails were discovered and current availability

#### Company Intelligence

- **Business Basics**: Company name, description, industry, and founding information
- **Location Data**: Complete address, city, state, country, and postal codes
- **Business Metrics**: Employee count, revenue estimates, and company type
- **Digital Presence**: Social media profiles and domain registration details

#### Search Metadata

- **Result Counts**: Total emails found and pagination information
- **Search Parameters**: Applied filters and search configuration
- **Processing Status**: Success rates and error information

### Key Data Fields

**Email Information:**

- `email`: Email address
- `first_name`, `last_name`, `full_name`: Personal names
- `position`: Job title and role
- `department`: Organizational department
- `seniority`: Job level (senior, junior, executive, etc.)
- `type`: Email type (personal, generic, etc.)
- `country`: Person's location
- `linkedin`: LinkedIn profile URL
- `score`: Confidence score (0-100)
- `verification.status`: Email validity (valid, invalid, risky, etc.)
- `verification.date`: Last verification timestamp

**Company Information:**

- `organization.organization`: Company name
- `organization.description`: Business description
- `organization.industries`: Industry classification
- `organization.founded`: Year established
- `organization.company_size`: Employee count range
- `organization.revenue`: Revenue estimates
- `organization.location.*`: Complete address details
- `organization.social_links.*`: Social media profiles
- `organization.whois.*`: Domain registration data

**Source Tracking:**

- `sources`: Array of discovery sources
- `uri`: Specific webpage URLs where emails were found
- `extracted_on`: Discovery date
- `last_seen_on`: Last verification date
- `still_on_page`: Current availability status

### Key Benefits

- **Comprehensive Email Discovery**: Find verified contact information with detailed professional context
- **Company Intelligence**: Get complete business profiles alongside contact data
- **Quality Assurance**: Email verification and confidence scoring for better targeting
- **Source Transparency**: Know exactly where contact information was discovered
- **Flexible Filtering**: Target specific departments, locations, and seniority levels

## Use Cases

- **Lead Generation**: Discover verified contact emails for potential customers and prospects
- **Sales Outreach**: Build targeted email lists for specific companies and departments
- **Recruitment**: Find contact information for potential candidates in specific roles
- **Market Research**: Analyze email patterns and organizational structures across competitors
- **Data Enrichment**: Enhance existing contact databases with fresh, verified information
- **Competitive Intelligence**: Research team structures and key personnel at target companies
- **Partnership Development**: Find decision-makers and relevant contacts for business partnerships

## API Rate Limits & Performance

### Domain Search Rate Limits

- **15 requests per second** - Tomba API allows up to 15 domain search requests per second
- **Built-in Rate Management**: Actor includes 1-second delays between domain requests
- **Efficient Processing**: Automatic rate limiting ensures stable operation without errors
- **High-Volume Support**: Designed for processing multiple domains within API constraints

### Performance Optimization

The Actor automatically handles performance optimization through:

- **Smart Rate Limiting**: 1-second delays between domain searches prevent API overload
- **Error Recovery**: Robust handling of network timeouts and API errors
- **Batch Processing**: Efficient processing of multiple domains in sequence
- **Memory Management**: Optimized data handling for large result sets

## Resources & Documentation

### API Documentation

- [Tomba API Docs](https://tomba.io/api) - Complete API reference and guides
- [Authentication Guide](https://app.tomba.io/api) - Get your API keys and setup
- [Pricing & Limits](https://tomba.io/pricing) - Understand rate limits and costs
- [Domain Search API](https://tomba.io/api/domain-search) - Specific endpoint documentation

## FAQ

### General Questions

**Q: What is domain search and how does it work?**
A: Domain search finds all email addresses associated with a specific company domain. It scans public sources, web pages, and databases to discover professional email addresses for employees at that organization.

**Q: How accurate are the email addresses found?**
A: Tomba provides high-quality, verified email addresses. Each email comes with verification status and confidence scores. The accuracy rate is typically 95%+ for validated emails.

**Q: What domains can I search?**
A: You can search any company domain (e.g., stripe.com, google.com). The domain should be a valid business website. Personal email domains (gmail.com, yahoo.com) are not supported.

### Usage & Features

**Q: How many emails can I find per domain?**
A: You can set the limit using the `maxEmailsPerDomain` parameter (1-100). The default is 10 emails per domain. Higher limits may require more API credits.

**Q: Can I filter results by department or country?**
A: Yes! Use the `department` parameter to filter by specific departments (engineering, sales, marketing, etc.) and the `country` parameter to filter by geographic location.

**Q: What's the difference between detailed and simple output formats?**
A: Detailed format includes complete contact information, company data, and verification details. Simple format provides just the essential email and name information.

**Q: How does pagination work?**
A: Use the `page` parameter to navigate through results. Each page contains the number of emails specified in your `limit` parameter. Check `meta.total` to see the total available results.

### Technical Questions

**Q: What are the rate limits?**
A: The Actor automatically handles Tomba's rate limits (15 requests/second). You don't need to worry about throttling - it's managed automatically.

**Q: Can I process multiple domains at once?**
A: Yes, provide an array of domains in the `domains` parameter. We recommend processing 5-20 domains at a time for optimal performance.

**Q: How should I handle API errors?**
A: The Actor provides detailed error messages. Common issues include invalid API keys, exceeded quota, or invalid domain formats. Check the output for specific error details.

**Q: What happens if a domain has no emails?**
A: The result will show an empty `emails` array but may still include company information if available. This is normal for new companies or domains with no public email presence.

### Data & Privacy

**Q: Is the email data GDPR compliant?**
A: Yes, Tomba follows GDPR guidelines and only collects publicly available information. All data sources are legitimate and comply with privacy regulations.

**Q: How often is the email data updated?**
A: Tomba continuously updates its database. Email verification dates are included in the results to show data freshness.

**Q: Can I export the results?**
A: Yes, all results are available in JSON format through the Actor's dataset. You can also download the data as CSV, Excel, or other formats from the Apify platform.

## Keywords

domain search, email discovery, company email finder, domain analysis, contact discovery, business emails, corporate contacts, lead generation, prospect research, email search, domain intelligence, business development

## Support

If you need any help, have questions, or encounter any issues while using Tomba.io, please don't hesitate to reach out to our support team. You can contact us via:

- **Email**: support@tomba.io
- **Live chat**: Available on the Tomba.io website during business hours

## Contributing

We welcome contributions to improve this actor. Please feel free to submit issues, feature requests, or pull requests to help make this tool even better for the community.

## About Tomba

Founded in 2020, Tomba prides itself on being the most reliable, accurate, and in-depth source of email address data available anywhere. We process terabytes of data to produce our Email finder API.

![Tomba Logo](https://tomba.io/logo.png)
