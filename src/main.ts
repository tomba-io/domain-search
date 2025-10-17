// Apify SDK - toolkit for building Apify Actors (Read more at https://docs.apify.com/sdk/js/)
import { Actor } from 'apify';
// Tomba API client for email finding
import { Domain, TombaClient } from 'tomba';

/**
 * Domain Search Rate Limits
 *
 * Tomba API Rate Limits:
 * - Domain Search: 15 requests per second maximum
 * - This Actor implements a 1-second delay between domain requests
 * - This ensures we stay well within the rate limit (1 request per second)
 * - Prevents API rate limit errors and ensures stable operation
 * - Allows for efficient management of searches without exceeding platform constraints
 */
const RATE_LIMIT_DELAY_MS = 1000; // 1 second delay between requests

/**
 * Sleep function to implement rate limiting
 * @param ms - Milliseconds to wait
 */
const sleep = async (ms: number): Promise<void> => {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
};

// Define the input interface for the Actor
interface ActorInput {
    tombaApiKey: string;
    tombaApiSecret: string;
    domains: string[];
    maxEmailsPerDomain?: number;
    includeCompanyInfo?: boolean;
    outputFormat?: 'detailed' | 'simple';
    // Domain search query parameters
    page?: number;
    limit?: '10' | '20' | '50';
    department?:
        | 'engineering'
        | 'sales'
        | 'finance'
        | 'hr'
        | 'it'
        | 'marketing'
        | 'operations'
        | 'management'
        | 'executive'
        | 'legal'
        | 'support'
        | 'communication'
        | 'software'
        | 'security'
        | 'pr'
        | 'warehouse'
        | 'diversity'
        | 'administrative'
        | 'facilities'
        | 'accounting';
    country?: string; // Two-letter country code (e.g., "US")
}

// Remove the EmailResult interface and work directly with DomainSearchResponse data

// The init() call configures the Actor for its environment
await Actor.init();

try {
    console.log('🚀 Tomba Email Finder Actor started');

    // Get Actor input
    const input = await Actor.getInput<ActorInput>();

    if (!input) {
        throw new Error('No input provided');
    }

    // Validate required input
    if (!input.tombaApiKey) {
        throw new Error('Tomba API key is required');
    }

    if (!input.tombaApiSecret) {
        throw new Error('Tomba API secret is required');
    }

    if (!input.domains || input.domains.length === 0) {
        throw new Error('At least one domain is required');
    }

    console.log(`📧 Processing ${input.domains.length} domain(s)`);
    console.log(
        `⏱️ Rate limiting: ${RATE_LIMIT_DELAY_MS / 1000}s delay between requests (respecting 15 req/sec limit)`,
    );

    // Initialize Tomba client
    const client = new TombaClient();
    const domainService = new Domain(client);

    client.setKey(input.tombaApiKey).setSecret(input.tombaApiSecret);

    const results: unknown[] = [];

    // Process each domain
    for (const domainName of input.domains) {
        try {
            console.log(`🔍 Searching emails for domain: ${domainName}`);

            // Domain search - find emails associated with the domain
            try {
                // Log search parameters being used
                const searchParams = {
                    domain: domainName,
                    page: input.page,
                    limit: input.limit,
                    department: input.department,
                    country: input.country,
                };

                // Filter out undefined values for logging
                const activeParams = Object.fromEntries(
                    Object.entries(searchParams).filter(([_, value]) => value !== undefined),
                );

                if (Object.keys(activeParams).length > 1) {
                    // More than just domain
                    console.log(`📋 Search parameters:`, activeParams);
                }

                const domainSearchResponse = await domainService.domainSearch(
                    domainName,
                    input.page?.toString(),
                    input.limit,
                    input.department,
                    input.country,
                );

                // Push the raw domain search response data directly
                if (domainSearchResponse.data) {
                    results.push(domainSearchResponse.data);
                }
            } catch (domainError) {
                console.warn(`⚠️ Domain search failed for ${domainName}:`, domainError);
            }

            // Add delay to respect API rate limits (Domain Search: 15 requests/second max)
            // Using 1-second delay to stay well within limits and ensure stable operation
            await sleep(RATE_LIMIT_DELAY_MS);
        } catch (error) {
            console.error(`❌ Error processing domain ${domainName}:`, error);

            // Push error result
            results.push({
                domain: domainName,
                error: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
        }
    }

    console.log(`✅ Found ${results.length} email results`);

    // Save results to dataset
    if (results.length > 0) {
        await Actor.pushData(results);
    }

    // Save summary to key-value store
    const summary = {
        totalDomains: input.domains.length,
        totalResults: results.length,
        processedAt: new Date().toISOString(),
        settings: {
            maxEmailsPerDomain: input.maxEmailsPerDomain || 10,
            includeCompanyInfo: input.includeCompanyInfo || false,
            page: input.page,
            limit: input.limit,
            department: input.department,
            country: input.country,
        },
    };

    await Actor.setValue('SUMMARY', summary);

    console.log('📊 Summary:', summary);
} catch (error) {
    console.error('💥 Actor failed:', error);
    throw error;
}

// Gracefully exit the Actor process
await Actor.exit();
