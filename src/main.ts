import { Actor, log } from 'apify';
import { Domain } from 'tomba';

import { InputError, queryBool, queryInt, queryList, queryString, runActor } from './standby.js';
import type { RunOptions } from './tomba.js';
import {
    callTomba,
    EVENT_REQUEST,
    getClient,
    hasPhoneData,
    isBillable,
    normalizeDomain,
    PHONE_CREDITS,
    phoneDataCount,
    runPool,
    stats,
    unique,
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

/**
 * Domain Search pricing: 1 credit per 10 results requested with `limit` (rounded up),
 * plus 5 credits per returned address with phone data (a non-empty `phone_data` array, only
 * returned with `enrich_mobile=true`). Each credit is one `tomba-request` event.
 */
function domainSearchCredits(requestLimit: number, emails: unknown, enrichMobile: boolean): number {
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

await runActor<ActorInput>({
    title: 'Domain Search',
    count: (input) => (input.domains?.length ?? 0) + (input.companies?.length ?? 0),
    fromQuery: (query) => ({
        domains: queryList(query, 'domain', 'domains'),
        companies: queryList(query, 'company', 'companies'),
        maxEmailsPerDomain: queryInt(query, 'maxEmailsPerDomain'),
        includeCompanyInfo: queryBool(query, 'includeCompanyInfo'),
        page: queryInt(query, 'page'),
        limit: queryString(query, 'limit') as ActorInput['limit'],
        department: queryString(query, 'department') as Department | undefined,
        country: queryString(query, 'country'),
        enrichMobile: queryBool(query, 'enrichMobile'),
        webhookUrl: queryString(query, 'webhookUrl'),
    }),
    run: async (input, { push, isDone, markDone, standby }) => {
        const {
            domains: rawDomains = [],
            companies: rawCompanies = [],
            maxEmailsPerDomain = 10,
            includeCompanyInfo = true,
            outputFormat,
            page: startPage = 1,
            limit = '10',
            department,
            country: rawCountry,
            enrichMobile = false,
            webhookUrl: rawWebhookUrl,
        } = input;
        const country =
            typeof rawCountry === 'string' && rawCountry.trim() ? rawCountry.trim().toUpperCase() : undefined;

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
            throw new InputError(
                'Input must contain at least one domain in "domains" or one company name in "companies".',
            );
        }

        const webhookUrl = rawWebhookUrl?.trim() || undefined;
        if (webhookUrl && !/^https?:\/\//i.test(webhookUrl)) {
            throw new InputError('"webhookUrl" must start with http:// or https://.');
        }

        const domainService = new Domain(getClient());

        const targets: Target[] = [
            ...domains.map((value): Target => ({ kind: 'domain', value, key: value })),
            ...companies.map((value): Target => ({ kind: 'company', value, key: `company:${value.toLowerCase()}` })),
        ];
        const pending = targets.filter((t) => !isDone(t.key));
        if (pending.length < targets.length) {
            log.info(`Resuming: ${targets.length - pending.length} searches already processed.`);
        }

        const pageSize = Number(limit);
        const maxEmails = Math.max(1, maxEmailsPerDomain);
        if (!standby) {
            log.info(`Searching emails for ${pending.length} domains/companies`, {
                maxEmailsPerDomain: maxEmails,
                limit,
                department,
                country,
                enrichMobile,
            });
        }

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
                    (body) => domainSearchCredits(pageSize, (body.data as SearchBody['data'])?.emails, enrichMobile),
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
                await push({ ...id, charged: false, cached: false, error });
                log.info(`${label}: ${error}`);
            } else {
                const phoneNumbers = emails.reduce<number>((sum, e) => sum + phoneDataCount(e), 0);
                await push({
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

            markDone(target.key);
        });

        // The run summary only makes sense for a batch run; Standby requests share one process.
        if (!standby) {
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
        }
    },
});
