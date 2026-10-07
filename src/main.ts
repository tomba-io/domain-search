import { Actor, log } from 'apify';
import { Domain } from 'tomba';

import type { RunOptions } from './tomba.js';
import {
    callTomba,
    EVENT_REQUEST,
    hasPhoneData,
    isBillable,
    logSummary,
    normalizeDomain,
    PHONE_CREDITS,
    phoneDataCount,
    runPool,
    setupTomba,
    stats,
    unique,
    useRunState,
} from './tomba.js';

/** Departments documented by Tomba (the SDK type lacks `education` and `healthcare`, the API accepts them). */
type Department =
    | 'accounting'
    | 'administrative'
    | 'communication'
    | 'diversity'
    | 'education'
    | 'engineering'
    | 'executive'
    | 'facilities'
    | 'finance'
    | 'healthcare'
    | 'hr'
    | 'it'
    | 'legal'
    | 'management'
    | 'marketing'
    | 'operations'
    | 'pr'
    | 'sales'
    | 'security'
    | 'software'
    | 'support'
    | 'warehouse';

interface ActorInput extends RunOptions {
    domains?: string[];
    companies?: string[];
    maxEmailsPerDomain?: number;
    includeCompanyInfo?: boolean;
    outputFormat?: 'detailed' | 'simple';
    // Domain search query parameters
    page?: number;
    limit?: '10' | '20' | '50';
    department?: Department;
    country?: string; // Two-letter country code (e.g., "US")
    enrichMobile?: boolean;
    webhookUrl?: string;
}

interface SearchBody {
    data?: { organization?: { website_url?: unknown }; emails?: unknown[] };
    meta?: { total?: number; total_pages?: number; params?: { domain?: unknown } };
}

/** One search: by domain (`domain=`) or by company name (`company=`). */
interface Target {
    kind: 'domain' | 'company';
    value: string;
    /** Resume-state key. Domains keep their plain value; company names are prefixed so they never collide. */
    key: string;
}

type DomainSearchParams = Parameters<Domain['domainSearch']>[0];

await Actor.init();

const input = (await Actor.getInput<ActorInput>()) ?? {};

const {
    domains: rawDomains = [],
    companies: rawCompanies = [],
    maxEmailsPerDomain = 10,
    includeCompanyInfo = true,
    outputFormat,
    page: startPage = 1,
    limit = '10',
    department,
    country,
    enrichMobile = false,
    webhookUrl: rawWebhookUrl,
    ...runOptions
} = input;

const domains = unique(
    (Array.isArray(rawDomains) ? rawDomains : []).filter((d) => typeof d === 'string').map(normalizeDomain),
);
const companies = unique(
    (Array.isArray(rawCompanies) ? rawCompanies : [])
        .filter((c) => typeof c === 'string')
        .map((c) => c.trim().replace(/\s+/g, ' '))
        .filter(Boolean),
    (c) => c.toLowerCase(),
);
if (!domains.length && !companies.length) {
    await Actor.fail('Input must contain at least one domain in "domains" or one company name in "companies".');
}

const webhookUrl = rawWebhookUrl?.trim() || undefined;
if (webhookUrl && !/^https?:\/\//i.test(webhookUrl)) {
    await Actor.fail('"webhookUrl" must start with http:// or https://.');
}

const client = await setupTomba(runOptions);
const domainService = new Domain(client);
const state = await useRunState();

const targets: Target[] = [
    ...domains.map((value): Target => ({ kind: 'domain', value, key: value })),
    ...companies.map((value): Target => ({ kind: 'company', value, key: `company:${value.toLowerCase()}` })),
];
const pending = targets.filter((t) => !state.done[t.key]);
if (pending.length < targets.length) {
    log.info(`Resuming: ${targets.length - pending.length} searches already processed.`);
}

const pageSize = Number(limit);

/**
 * Domain Search pricing: 1 credit per 10 results requested with `limit` (rounded up),
 * plus 5 credits per returned address with phone data (a non-empty `phone_data` array, only
 * returned with `enrich_mobile=true`). Each credit is one `tomba-request` event.
 */
function domainSearchCredits(requestLimit: number, emails: unknown): number {
    const base = Math.ceil(requestLimit / 10);
    if (!enrichMobile || !Array.isArray(emails)) return base;
    return base + PHONE_CREDITS * emails.filter(hasPhoneData).length;
}

/** The domain Tomba resolved for a company search, if it reports one. */
function resolvedDomain(body: SearchBody): string | undefined {
    const candidates = [body.meta?.params?.domain, body.data?.organization?.website_url];
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) return normalizeDomain(candidate);
    }
    return undefined;
}

const maxEmails = Math.max(1, maxEmailsPerDomain);
const startedAt = Date.now();
log.info(`Searching emails for ${pending.length} domains/companies`, {
    maxEmailsPerDomain: maxEmails,
    limit,
    department,
    country,
    enrichMobile,
});

await runPool(pending, async (target) => {
    const label = target.kind === 'domain' ? target.value : `company "${target.value}"`;
    const id = target.kind === 'domain' ? { domain: target.value } : { company: target.value };
    let organization: unknown;
    let meta: unknown;
    let domain: string | undefined;
    const emails: unknown[] = [];
    let pages = 0;
    let chargedPages = 0;
    let chargedCredits = 0;
    let allCached = true;
    let error: string | undefined;

    // Pages of one search are fetched sequentially; each page is one billable request.
    for (let page = Math.max(1, startPage); emails.length < maxEmails; page++) {
        const params: Record<string, unknown> = { ...id, page, limit };
        if (department) params.department = department;
        if (country) params.country = country;
        if (enrichMobile) params.enrich_mobile = true;
        if (webhookUrl) params.webhook_url = webhookUrl;
        const res = await callTomba(
            'domain-search',
            params,
            async () => domainService.domainSearch(params as DomainSearchParams),
            EVENT_REQUEST,
            (body) => domainSearchCredits(pageSize, (body.data as SearchBody['data'])?.emails),
        );
        if (res.skipped) {
            // Max charge limit reached before the first page: leave the search for a later run.
            if (pages === 0) return;
            break;
        }

        if (!isBillable(res.body)) {
            if (pages === 0) error = res.error ?? 'No results found';
            else log.warning(`${label}: page ${page} returned no results`, { error: res.error });
            break;
        }

        const body = res.body as SearchBody;
        pages++;
        if (res.charged) chargedPages++;
        chargedCredits += res.chargedCount ?? 0;
        if (!res.cached) allCached = false;
        organization ??= body.data?.organization;
        domain ??= target.kind === 'company' ? resolvedDomain(body) : undefined;
        meta = body.meta;

        const pageEmails = Array.isArray(body.data?.emails) ? body.data.emails : [];
        emails.push(...pageEmails.slice(0, maxEmails - emails.length));

        const totalPages = body.meta?.total_pages;
        const total = body.meta?.total;
        const noMore =
            pageEmails.length < pageSize ||
            (typeof totalPages === 'number' && page >= totalPages) ||
            (typeof total === 'number' && emails.length >= total);
        if (noMore) break;
    }

    if (pages === 0) {
        await Actor.pushData({ ...id, charged: false, cached: false, error });
        log.info(`${label}: ${error}`);
    } else {
        const phoneNumbers = emails.reduce<number>((sum, e) => sum + phoneDataCount(e), 0);
        await Actor.pushData({
            ...id,
            ...(domain ? { domain } : {}),
            ...(includeCompanyInfo ? { organization } : {}),
            emails,
            phoneNumbers,
            meta,
            pages,
            chargedRequests: chargedPages,
            chargedCredits,
            charged: chargedPages > 0,
            cached: allCached,
        });
        log.info(
            `${label}: ${emails.length} emails${enrichMobile ? `, ${phoneNumbers} phone numbers` : ''} from ${pages} page(s)${allCached ? ' (cached)' : ''}`,
        );
    }

    state.done[target.key] = true;
});

await Actor.setValue('SUMMARY', {
    totalDomains: domains.length,
    totalCompanies: companies.length,
    tombaRequests: stats.requests,
    chargedRequests: stats.charged,
    cacheHits: stats.cached,
    processedAt: new Date().toISOString(),
    settings: {
        maxEmailsPerDomain: maxEmails,
        includeCompanyInfo,
        outputFormat,
        page: startPage,
        limit,
        department,
        country,
        enrichMobile,
        webhookUrl,
    },
});

logSummary('Domain Search', targets.length, startedAt);

await Actor.exit();
