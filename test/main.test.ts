// End-to-end tests: run the Actor against a mock Tomba API.
import assert from 'node:assert/strict';
import { after, afterEach, describe, it } from 'node:test';

import type { MockHandler, MockServer } from './helpers.js';
import { removeStorage, runActor, startMockTomba, startStandbyActor, totalCharges } from './helpers.js';

function organization(domain: string) {
    return {
        website_url: domain,
        organization: 'Stripe',
        location: {
            country: 'US',
            city: 'San Francisco',
            state: 'California',
            street_address: '354 Oyster Point Blvd',
            postal_code: '94080',
        },
        social_links: {
            twitter_url: 'https://twitter.com/stripe',
            facebook_url: null,
            linkedin_url: 'https://www.linkedin.com/company/stripe',
        },
        phone_number: '+1 415 298 5539',
        industries: 'Information Technology and Services',
        founded: '2010',
        company_size: '5K-10K',
        company_type: 'privately held',
        revenue: '$100M-$250M',
        accept_all: false,
        description: 'Stripe is a payment processing platform.',
        pattern: '{first}',
        disposable: false,
        webmail: false,
    };
}

const PHONE = { number: '+14155550123', type: 'mobile' };

function email(domain: string, n: number, enrichMobile = false) {
    return {
        email: `person${n}@${domain}`,
        first_name: `First${n}`,
        last_name: `Last${n}`,
        full_name: `First${n} Last${n}`,
        gender: 'female',
        // Tomba's "has a phone number" flag: informational only, it does not affect pricing.
        phone_number: domain === 'phones.com' && n % 3 === 0,
        // With enrich_mobile=true every third address carries its phone numbers.
        ...(enrichMobile ? { phone_data: n % 3 === 0 ? [PHONE] : [] } : {}),
        type: 'personal',
        country: 'US',
        position: 'Financial Crimes Analyst',
        department: 'finance',
        seniority: 'senior',
        twitter: null,
        linkedin: `https://www.linkedin.com/in/person${n}`,
        accept_all: false,
        pattern: '{first}',
        score: 99,
        verification: { date: '2025-09-13T00:00:00+02:00', status: 'valid' },
        last_updated_at: '2025-09-13T00:00:00+02:00',
        sources: [
            {
                uri: `https://${domain}/about`,
                website_url: domain,
                extracted_on: '2024-01-01T00:00:00+02:00',
                last_seen_on: '2025-09-01T00:00:00+02:00',
                still_on_page: true,
            },
        ],
    };
}

/** Number of emails Tomba knows for each test domain (default 25). */
const EMAIL_COUNTS: Record<string, number> = { 'exact.com': 20, 'nometa.com': 15, 'nomail.com': 0 };

/** A realistic paged Domain Search response. */
function searchPage(query: Record<string, string>, withMeta = true) {
    // A company search resolves the company name to its domain.
    const domain =
        query.domain ??
        `${String(query.company)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')}.com`;
    const enrichMobile = query.enrich_mobile === 'true';
    const total = EMAIL_COUNTS[domain] ?? 25;
    const pageSize = Number(query.limit ?? 10);
    const page = Number(query.page ?? 1);
    const first = (page - 1) * pageSize;
    const emails = Array.from({ length: Math.max(0, Math.min(pageSize, total - first)) }, (_, i) =>
        email(domain, first + i + 1, enrichMobile),
    );
    return {
        data: { organization: organization(domain), emails },
        ...(withMeta
            ? {
                  meta: {
                      total,
                      pageSize,
                      current: page,
                      total_pages: Math.ceil(total / pageSize),
                      params: { domain, page, limit: pageSize },
                  },
              }
            : {}),
    };
}

/** Default Tomba behaviour. */
const tomba: MockHandler = (req) => {
    assert.equal(req.method, 'GET');
    assert.equal(req.path, '/domain-search');
    const { domain, page } = req.query;
    if (domain === 'empty.com') return { body: { data: null } };
    if (domain === 'invalid.com') return { status: 422, body: { errors: { message: 'Invalid domain' } } };
    if (domain === 'html.com') return { raw: '<html>Bad gateway</html>' };
    if (domain === 'brokenpage.com' && page === '2') return { status: 422, body: { errors: { message: 'Bad page' } } };
    return { body: searchPage(req.query, domain !== 'nometa.com') };
};

const servers: MockServer[] = [];
const dirs: string[] = [];

async function mock(handler: MockHandler = tomba): Promise<MockServer> {
    const server = await startMockTomba(handler);
    servers.push(server);
    return server;
}

async function run(...args: Parameters<typeof runActor>) {
    const result = await runActor(...args);
    dirs.push(result.storageDir);
    return result;
}

const pagesRequested = (server: MockServer) => server.requests.map((r) => `${r.query.domain}#${r.query.page}`);

afterEach(async () => {
    await Promise.all(servers.splice(0).map(async (s) => s.close()));
});

after(async () => {
    await Promise.all(dirs.map(removeStorage));
});

describe('domain-search', () => {
    it('returns one item per domain and charges one event per billable page', async () => {
        const server = await mock();
        const result = await run({ input: { domains: ['stripe.com'] }, endpoint: server.url });

        assert.equal(result.code, 0, result.output);
        assert.equal(result.items.length, 1);
        const expected = searchPage({ domain: 'stripe.com', page: '1', limit: '10' });
        assert.deepEqual(result.items[0], {
            domain: 'stripe.com',
            organization: expected.data.organization,
            emails: expected.data.emails,
            phoneNumbers: 0,
            meta: expected.meta,
            pages: 1,
            chargedRequests: 1,
            chargedCredits: 1,
            charged: true,
            cached: false,
        });
        assert.deepEqual(server.requests[0].query, { domain: 'stripe.com', page: '1', limit: '10' });
        assert.deepEqual(result.chargeCounts, { 'tomba-request': 1 });
    });

    describe('pricing: 1 credit per 10 results requested, +5 per address with phone data', () => {
        for (const [limit, credits] of [
            ['10', 1],
            ['20', 2],
            ['50', 5],
        ] as const) {
            it(`limit ${limit} costs ${credits} credit(s) per page`, async () => {
                const server = await mock();
                const result = await run({
                    input: { domains: ['stripe.com'], limit, maxEmailsPerDomain: Number(limit) },
                    endpoint: server.url,
                });
                assert.equal(server.requests.length, 1);
                assert.equal(result.items[0].chargedCredits, credits);
                assert.deepEqual(result.chargeCounts, { 'tomba-request': credits });
            });
        }

        it('does not charge extra for the phone_number flag alone', async () => {
            const server = await mock();
            const result = await run({
                input: { domains: ['phones.com'], limit: '10', maxEmailsPerDomain: 10 },
                endpoint: server.url,
            });
            const emails = result.items[0].emails as { phone_number: boolean; phone_data?: unknown }[];
            assert.equal(emails.filter((e) => e.phone_number).length, 3);
            assert.ok(emails.every((e) => e.phone_data === undefined));
            assert.equal(result.items[0].phoneNumbers, 0);
            assert.equal(result.items[0].chargedCredits, 1);
            assert.deepEqual(result.chargeCounts, { 'tomba-request': 1 });
        });

        it('with enrichMobile adds 5 credits per returned address with phone data', async () => {
            const server = await mock();
            const result = await run({
                input: { domains: ['phones.com'], limit: '10', maxEmailsPerDomain: 10, enrichMobile: true },
                endpoint: server.url,
            });
            // 10 addresses, 3 with phone data (3, 6, 9): 1 + 3 x 5 = 16 credits.
            const emails = result.items[0].emails as { phone_data: unknown[] }[];
            assert.equal(emails.filter((e) => e.phone_data.length > 0).length, 3);
            assert.equal(result.items[0].chargedCredits, 16);
            assert.deepEqual(result.chargeCounts, { 'tomba-request': 16 });
        });

        it('charges the phone data of the whole returned page, even when fewer addresses are kept', async () => {
            const server = await mock();
            const result = await run({
                input: { domains: ['phones.com'], limit: '20', maxEmailsPerDomain: 2, enrichMobile: true },
                endpoint: server.url,
            });
            // limit 20 returns 20 addresses (6 with phone data) even though only 2 are kept: 2 + 6 x 5 = 32.
            assert.equal(result.items[0].chargedCredits, 32);
            assert.equal(result.items[0].phoneNumbers, 0);
        });

        it('charges every page by its own results', async () => {
            const server = await mock();
            const result = await run({
                input: { domains: ['phones.com'], limit: '10', maxEmailsPerDomain: 25, enrichMobile: true },
                endpoint: server.url,
            });
            // Pages of 10, 10 and 5 addresses with 3, 3 and 2 phones: (1+15) + (1+15) + (1+10) = 43.
            assert.equal(server.requests.length, 3);
            assert.equal(result.items[0].chargedCredits, 43);
            assert.deepEqual(result.chargeCounts, { 'tomba-request': 43 });
        });

        it('charges the base credits for a company with no addresses', async () => {
            const server = await mock();
            const result = await run({ input: { domains: ['nomail.com'], limit: '50' }, endpoint: server.url });
            assert.equal(result.items[0].chargedCredits, 5);
            assert.deepEqual(result.chargeCounts, { 'tomba-request': 5 });
        });

        it('charges nothing for cached pages', async () => {
            const server = await mock();
            const input = { domains: ['phones.com'], limit: '10', maxEmailsPerDomain: 10, enrichMobile: true };
            const first = await run({ input, endpoint: server.url });
            assert.equal(first.items[0].chargedCredits, 16);
            const second = await run({
                input,
                endpoint: server.url,
                storageDir: first.storageDir,
            });
            assert.equal(second.items[0].chargedCredits, 0);
            assert.equal(second.items[0].cached, true);
            assert.deepEqual(second.chargeCounts, {});
        });
    });

    it('sends the built-in credentials to Tomba', async () => {
        const server = await mock();
        await run({ input: { domains: ['stripe.com'] }, endpoint: server.url });
        assert.equal(server.requests[0].headers['x-tomba-key'], 'ta_test_key');
        assert.equal(server.requests[0].headers['x-tomba-secret'], 'ts_test_secret');
    });

    it('normalizes and deduplicates domains', async () => {
        const server = await mock();
        await run({
            input: { domains: ['https://www.Stripe.com/jobs', 'stripe.com', 'STRIPE.COM '] },
            endpoint: server.url,
        });
        assert.deepEqual(
            server.requests.map((r) => r.query.domain),
            ['stripe.com'],
        );
    });

    it('passes the filters and the start page to Tomba', async () => {
        const server = await mock();
        await run({
            input: { domains: ['stripe.com'], page: 2, limit: '20', department: 'finance', country: 'US' },
            endpoint: server.url,
        });
        assert.deepEqual(server.requests[0].query, {
            domain: 'stripe.com',
            page: '2',
            limit: '20',
            department: 'finance',
            country: 'US',
        });
    });

    it('sends enrich_mobile and webhook_url as query parameters', async () => {
        const server = await mock();
        await run({
            input: { domains: ['stripe.com'], enrichMobile: true, webhookUrl: 'https://example.com/hook' },
            endpoint: server.url,
        });
        assert.deepEqual(server.requests[0].query, {
            domain: 'stripe.com',
            page: '1',
            limit: '10',
            enrich_mobile: 'true',
            webhook_url: 'https://example.com/hook',
        });
    });

    it('does not send enrich_mobile when enrichMobile is off', async () => {
        const server = await mock();
        await run({ input: { domains: ['stripe.com'], enrichMobile: false }, endpoint: server.url });
        assert.equal('enrich_mobile' in server.requests[0].query, false);
        assert.equal('webhook_url' in server.requests[0].query, false);
    });

    it('fails on a webhook URL that is not http(s) without calling Tomba', async () => {
        const server = await mock();
        const result = await run({
            input: { domains: ['stripe.com'], webhookUrl: 'ftp://example.com' },
            endpoint: server.url,
        });
        assert.notEqual(result.code, 0);
        assert.equal(server.requests.length, 0);
    });

    it('reports the phone numbers returned with enrichMobile', async () => {
        const server = await mock();
        const result = await run({
            input: { domains: ['phones.com'], maxEmailsPerDomain: 10, enrichMobile: true },
            endpoint: server.url,
        });
        const emails = result.items[0].emails as { email: string; phone_data: unknown[] }[];
        assert.deepEqual(emails[2].phone_data, [{ number: '+14155550123', type: 'mobile' }]);
        assert.deepEqual(emails[0].phone_data, []);
        assert.equal(result.items[0].phoneNumbers, 3);
    });

    it('searches company names with company instead of domain and deduplicates them', async () => {
        const server = await mock();
        const result = await run({
            input: { companies: ['Stripe', ' stripe ', 'Acme  Corp', ''] },
            endpoint: server.url,
        });
        assert.equal(result.code, 0, result.output);
        assert.deepEqual(
            server.requests.map((r) => r.query),
            [
                { company: 'Stripe', page: '1', limit: '10' },
                { company: 'Acme Corp', page: '1', limit: '10' },
            ],
        );
        const byCompany = Object.fromEntries(result.items.map((i) => [i.company, i]));
        assert.equal(byCompany.Stripe.domain, 'stripe.com');
        assert.equal((byCompany.Stripe.emails as unknown[]).length, 10);
        assert.equal(byCompany.Stripe.chargedCredits, 1);
        assert.equal(byCompany['Acme Corp'].domain, 'acmecorp.com');
        assert.deepEqual(result.chargeCounts, { 'tomba-request': 2 });
    });

    it('omits domain for a company search when Tomba does not report one', async () => {
        const server = await mock(() => ({ body: { data: { organization: { organization: 'X' }, emails: [] } } }));
        const result = await run({ input: { companies: ['Nowhere'] }, endpoint: server.url });
        assert.equal(result.items[0].company, 'Nowhere');
        assert.equal('domain' in result.items[0], false);
    });

    it('saves a company search without results with the company name', async () => {
        const server = await mock(() => ({ body: { data: null } }));
        const result = await run({ input: { companies: ['Unknown Co'] }, endpoint: server.url });
        assert.deepEqual(result.items, [
            { company: 'Unknown Co', charged: false, cached: false, error: 'No results found' },
        ]);
        assert.equal(totalCharges(result), 0);
    });

    it('searches domains and companies together and resumes them separately', async () => {
        const server = await mock();
        const input = { domains: ['stripe.com'], companies: ['Stripe'], useCache: false };
        const first = await run({ input, endpoint: server.url });
        assert.equal(first.code, 0, first.output);
        assert.deepEqual(
            server.requests.map((r) => r.query.domain ?? `company:${r.query.company}`),
            ['stripe.com', 'company:Stripe'],
        );
        assert.equal(first.items.length, 2);
        assert.deepEqual(first.chargeCounts, { 'tomba-request': 2 });

        // A resumed run (same storage) has nothing left to do.
        await run({ input, endpoint: server.url, storageDir: first.storageDir, keepStorage: true });
        assert.equal(server.requests.length, 2);
    });

    it('caches domain and company searches separately', async () => {
        const server = await mock();
        const first = await run({ input: { domains: ['stripe.com'] }, endpoint: server.url });
        const second = await run({
            input: { companies: ['Stripe'] },
            endpoint: server.url,
            storageDir: first.storageDir,
        });
        assert.equal(server.requests.length, 2);
        assert.equal(second.items[0].cached, false);
        assert.equal(second.items[0].charged, true);
    });

    it('fails without domains or companies and never calls the API', async () => {
        const server = await mock();
        const result = await run({ input: { domains: [], companies: ['  '] }, endpoint: server.url });
        assert.notEqual(result.code, 0);
        assert.match(result.output, /domains.*companies/);
        assert.equal(server.requests.length, 0);
    });

    it('pages until maxEmailsPerDomain is reached, one request and one charge per page', async () => {
        const server = await mock();
        const result = await run({
            input: { domains: ['stripe.com'], maxEmailsPerDomain: 15, limit: '10' },
            endpoint: server.url,
        });
        assert.deepEqual(pagesRequested(server), ['stripe.com#1', 'stripe.com#2']);
        const item = result.items[0];
        assert.equal((item.emails as unknown[]).length, 15);
        assert.equal((item.emails as { email: string }[])[14].email, 'person15@stripe.com');
        assert.equal(item.pages, 2);
        assert.equal(item.chargedRequests, 2);
        assert.equal(item.charged, true);
        assert.deepEqual(result.chargeCounts, { 'tomba-request': 2 });
    });

    it('stops paging at the last page reported by Tomba', async () => {
        const server = await mock();
        const result = await run({
            input: { domains: ['exact.com'], maxEmailsPerDomain: 100, limit: '10' },
            endpoint: server.url,
        });
        // 20 emails, 2 full pages: total_pages stops paging without requesting an empty page 3.
        assert.deepEqual(pagesRequested(server), ['exact.com#1', 'exact.com#2']);
        assert.equal((result.items[0].emails as unknown[]).length, 20);
        assert.equal(totalCharges(result), 2);
    });

    it('stops paging at a short page', async () => {
        const server = await mock();
        const result = await run({
            input: { domains: ['nometa.com'], maxEmailsPerDomain: 100, limit: '10' },
            endpoint: server.url,
        });
        assert.deepEqual(pagesRequested(server), ['nometa.com#1', 'nometa.com#2']);
        assert.equal((result.items[0].emails as unknown[]).length, 15);
        assert.equal(result.items[0].pages, 2);
        assert.equal(totalCharges(result), 2);
    });

    it('keeps the pages it already paid for when a later page fails', async () => {
        const server = await mock();
        const result = await run({
            input: { domains: ['brokenpage.com'], maxEmailsPerDomain: 30, limit: '10' },
            endpoint: server.url,
        });
        assert.deepEqual(pagesRequested(server), ['brokenpage.com#1', 'brokenpage.com#2']);
        assert.equal((result.items[0].emails as unknown[]).length, 10);
        assert.equal(result.items[0].pages, 1);
        assert.equal(result.items[0].charged, true);
        assert.equal(totalCharges(result), 1);
    });

    it('charges an organization with zero emails as a negative answer', async () => {
        const server = await mock();
        const result = await run({ input: { domains: ['nomail.com'], maxEmailsPerDomain: 50 }, endpoint: server.url });
        assert.equal(server.requests.length, 1);
        const item = result.items[0];
        assert.deepEqual(item.emails, []);
        assert.equal((item.organization as { organization: string }).organization, 'Stripe');
        assert.equal(item.charged, true);
        assert.equal(item.error, undefined);
        assert.deepEqual(result.chargeCounts, { 'tomba-request': 1 });
    });

    it('omits the organization when includeCompanyInfo is false', async () => {
        const server = await mock();
        const result = await run({
            input: { domains: ['stripe.com'], includeCompanyInfo: false },
            endpoint: server.url,
        });
        assert.equal('organization' in result.items[0], false);
        assert.equal((result.items[0].emails as unknown[]).length, 10);
    });

    it('does not charge empty data', async () => {
        const server = await mock();
        const result = await run({ input: { domains: ['empty.com'] }, endpoint: server.url });
        assert.equal(result.code, 0, result.output);
        assert.deepEqual(result.items, [
            { domain: 'empty.com', charged: false, cached: false, error: 'No results found' },
        ]);
        assert.equal(totalCharges(result), 0);
    });

    it('does not charge Tomba error statuses and does not retry them', async () => {
        const server = await mock();
        const result = await run({ input: { domains: ['invalid.com'] }, endpoint: server.url });
        assert.equal(result.code, 0, result.output);
        assert.equal(server.requests.length, 1);
        assert.equal(result.items[0].charged, false);
        assert.match(String(result.items[0].error), /422: Invalid domain/);
        assert.equal(totalCharges(result), 0);
    });

    it('does not charge a non-JSON body', async () => {
        const server = await mock();
        const result = await run({ input: { domains: ['html.com'] }, endpoint: server.url });
        assert.equal(result.items[0].charged, false);
        assert.match(String(result.items[0].error), /Invalid response/);
        assert.equal(totalCharges(result), 0);
    });

    it('retries 429 and 5xx responses, then charges the success once', async () => {
        let calls = 0;
        const server = await mock(async (req) => {
            calls++;
            if (calls === 1)
                return {
                    status: 429,
                    body: { errors: { message: 'Too many requests' } },
                    headers: { 'retry-after': '1' },
                };
            if (calls === 2) return { status: 503, body: {} };
            return tomba(req);
        });
        const result = await run({ input: { domains: ['stripe.com'], maxRetries: 3 }, endpoint: server.url });
        assert.equal(server.requests.length, 3);
        assert.equal(result.items[0].charged, true);
        assert.deepEqual(result.chargeCounts, { 'tomba-request': 1 });
    });

    it('serves repeated runs from the cache for free', async () => {
        const server = await mock();
        const input = { domains: ['stripe.com'], maxEmailsPerDomain: 20 };
        const first = await run({ input, endpoint: server.url });
        assert.equal(totalCharges(first), 2);
        const second = await run({ input, endpoint: server.url, storageDir: first.storageDir });

        assert.equal(server.requests.length, 2);
        assert.equal(second.items.length, 1);
        assert.equal((second.items[0].emails as unknown[]).length, 20);
        assert.equal(second.items[0].cached, true);
        assert.equal(second.items[0].charged, false);
        assert.equal(second.items[0].chargedRequests, 0);
        assert.equal(totalCharges(second), 0);
    });

    it('calls Tomba again when the cache is disabled', async () => {
        const server = await mock();
        const first = await run({ input: { domains: ['stripe.com'], useCache: false }, endpoint: server.url });
        await run({
            input: { domains: ['stripe.com'], useCache: false },
            endpoint: server.url,
            storageDir: first.storageDir,
        });
        assert.equal(server.requests.length, 2);
    });

    it('stops at the max charge limit and resumes without reprocessing', async () => {
        const server = await mock();
        const domains = ['a.com', 'b.com', 'c.com', 'd.com', 'e.com'];
        const input = { domains, maxConcurrency: 1, useCache: false };

        // Locally every event costs $1, so a $2 budget allows two billable page requests.
        const first = await run({ input, endpoint: server.url, maxTotalChargeUsd: 2 });
        assert.equal(first.code, 0, first.output);
        assert.equal(totalCharges(first), 2);
        assert.equal(server.requests.length, 2);
        assert.deepEqual(
            first.items.map((i) => i.domain),
            ['a.com', 'b.com'],
        );

        const second = await run({ input, endpoint: server.url, storageDir: first.storageDir, keepStorage: true });
        assert.equal(second.code, 0, second.output);
        // The charging log is kept with the storage: 2 events from the first run + 3 new ones.
        assert.equal(totalCharges(second), 5);
        assert.deepEqual(
            server.requests.map((r) => r.query.domain),
            domains,
        );
    });

    it('stops paging a domain when the charge limit is reached mid-domain', async () => {
        const server = await mock();
        const result = await run({
            input: { domains: ['stripe.com'], maxEmailsPerDomain: 30, useCache: false },
            endpoint: server.url,
            maxTotalChargeUsd: 2,
        });
        assert.equal(result.code, 0, result.output);
        assert.deepEqual(pagesRequested(server), ['stripe.com#1', 'stripe.com#2']);
        assert.equal((result.items[0].emails as unknown[]).length, 20);
        assert.equal(totalCharges(result), 2);
    });

    it('runs domains in parallel', async () => {
        let active = 0;
        let peak = 0;
        const server = await mock(async (req) => {
            active++;
            peak = Math.max(peak, active);
            await new Promise((r) => {
                setTimeout(r, 100);
            });
            active--;
            return tomba(req);
        });
        const domains = Array.from({ length: 8 }, (_, i) => `site${i}.com`);
        await run({ input: { domains, maxConcurrency: 4 }, endpoint: server.url });
        assert.equal(server.requests.length, 8);
        assert.ok(peak > 1 && peak <= 4, `peak concurrency ${peak}`);
    });

    it('fails without Tomba credentials and never calls the API', async () => {
        const server = await mock();
        const result = await run({ input: { domains: ['stripe.com'] }, endpoint: server.url, withCredentials: false });
        assert.notEqual(result.code, 0);
        assert.match(result.output, /misconfigured/);
        assert.doesNotMatch(result.output, /ta_test_key|ts_test_secret/);
        assert.equal(server.requests.length, 0);
    });

    it('fails on empty input', async () => {
        const server = await mock();
        const result = await run({ input: { domains: [] }, endpoint: server.url });
        assert.notEqual(result.code, 0);
        assert.equal(server.requests.length, 0);
    });
});

describe('domain-search standby (real-time API)', () => {
    it('answers the readiness probe and a bare GET with usage info', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        try {
            const probe = await actor.call('/', { headers: { 'x-apify-container-server-readiness-probe': '1' } });
            assert.equal(probe.status, 200);
            const usage = await actor.call('/');
            assert.equal(usage.status, 200);
            assert.match(String(usage.body.usage), /GET/);
            assert.equal(server.requests.length, 0);
        } finally {
            await actor.stop();
        }
    });

    it('searches domains and companies from GET query parameters and charges the credits per page', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        let stopped;
        try {
            const res = await actor.call(
                '/?domain=https://www.Stripe.com/pricing&domain=empty.com&company=Acme&limit=20&maxEmailsPerDomain=30&department=finance&country=US&includeCompanyInfo=false',
            );
            assert.equal(res.status, 200);
            const items = res.body.items as Record<string, unknown>[];
            const stripe = items.find((i) => i.domain === 'stripe.com');
            // 25 emails: page 1 has 20, page 2 the last 5; each page of limit 20 costs 2 credits.
            assert.equal((stripe?.emails as unknown[]).length, 25);
            assert.equal(stripe?.pages, 2);
            assert.equal(stripe?.chargedCredits, 4);
            assert.equal(stripe?.organization, undefined);
            const acme = items.find((i) => i.company === 'Acme');
            assert.equal(acme?.domain, 'acme.com');
            assert.equal(acme?.chargedCredits, 4);
            assert.equal(items.find((i) => i.domain === 'empty.com')?.error, 'No results found');
            const first = server.requests.find((r) => r.query.domain === 'stripe.com');
            assert.equal(first?.query.department, 'finance');
            assert.equal(first?.query.country, 'US');
            assert.equal(first?.query.limit, '20');
        } finally {
            stopped = await actor.stop();
        }
        assert.deepEqual(stopped.chargeCounts, { 'tomba-request': 8 });
    });

    it('accepts a POST with the same JSON input as a normal run', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        let stopped;
        try {
            const res = await actor.call('/', { body: { domains: ['phones.com'], enrichMobile: true } });
            assert.equal(res.status, 200);
            const [item] = res.body.items as Record<string, unknown>[];
            assert.equal((item.emails as unknown[]).length, 10);
            // 1 base credit + 5 per address with phone data (3 of 10).
            assert.equal(item.phoneNumbers, 3);
            assert.equal(item.chargedCredits, 16);
            assert.equal(server.requests[0].query.enrich_mobile, 'true');
        } finally {
            stopped = await actor.stop();
        }
        assert.deepEqual(stopped.chargeCounts, { 'tomba-request': 16 });
    });

    it('serves repeated requests from the cache for free', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        let stopped;
        try {
            await actor.call('/?domain=stripe.com');
            const second = await actor.call('/?domain=stripe.com');
            assert.ok((second.body.items as Record<string, unknown>[]).every((i) => i.cached === true));
            assert.equal(server.requests.length, 1);
        } finally {
            stopped = await actor.stop();
        }
        assert.deepEqual(stopped.chargeCounts, { 'tomba-request': 1 });
    });

    it('keeps serving after a request stops at maxEmailsPerDomain', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        try {
            const first = await actor.call('/?domain=a.com&maxEmailsPerDomain=5');
            const [a] = first.body.items as Record<string, unknown>[];
            assert.equal((a.emails as unknown[]).length, 5);
            const second = await actor.call('/?domains=b.com,c.com&maxEmailsPerDomain=15');
            const items = second.body.items as Record<string, unknown>[];
            assert.deepEqual(
                items.map((i) => (i.emails as unknown[]).length),
                [15, 15],
            );
        } finally {
            await actor.stop();
        }
    });

    it('rejects invalid input with 400 and unknown paths with 404', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url });
        try {
            assert.equal((await actor.call('/', { body: {} })).status, 400);
            assert.equal((await actor.call('/', { body: 'not json' })).status, 400);
            assert.equal((await actor.call('/?page=abc&domain=a.com')).status, 400);
            assert.equal((await actor.call('/?enrichMobile=maybe&domain=a.com')).status, 400);
            assert.equal((await actor.call('/?webhookUrl=ftp://x&domain=a.com')).status, 400);
            assert.equal((await actor.call('/nope')).status, 404);
            assert.equal((await actor.call('/', { method: 'DELETE' })).status, 405);
            assert.equal(server.requests.length, 0);
        } finally {
            await actor.stop();
        }
    });

    it('returns 402 once the max charge limit is reached', async () => {
        const server = await mock();
        const actor = await startStandbyActor({ endpoint: server.url, maxTotalChargeUsd: 1 });
        try {
            const first = await actor.call('/?domain=a.com');
            assert.equal(first.status, 200);
            const second = await actor.call('/?domain=b.com');
            assert.equal(second.status, 402);
            assert.equal(server.requests.length, 1);
        } finally {
            await actor.stop();
        }
    });
});
