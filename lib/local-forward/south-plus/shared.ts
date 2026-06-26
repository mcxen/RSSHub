const southPlusRootUrl = 'https://south-plus.org';
const southPlusDefaultForumId = '48';
const southPlusLocalFeedPath = '/south-plus/local';
const southPlusManagerPath = '/manage/south-plus';

type SouthPlusForwardConfig = {
    cookie: string;
    forumUrl: string;
    includeKeywords: string[];
    excludeKeywords: string[];
    includeAuthors: string[];
    excludeAuthors: string[];
    includeCategories: string[];
    excludeCategories: string[];
    updatedAt: string;
};

type SouthPlusForwardFilters = Pick<
    SouthPlusForwardConfig,
    'includeKeywords' | 'excludeKeywords' | 'includeAuthors' | 'excludeAuthors' | 'includeCategories' | 'excludeCategories'
>;

type SouthPlusForwardConfigSummary = {
    configured: boolean;
    forumId: string;
    forumUrl: string;
    cookiePreview: string;
    cookieLength: number;
    filters: SouthPlusForwardFilters;
    activeFilterCount: number;
    updatedAt?: string;
};

const forumUrlPatterns = [/thread\.php\?fid[-=](\d+)/i, /thread\.php\/?\?fid=(\d+)/i, /fid[-=](\d+)/i];

const normalizeSouthPlusUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) {
        return '';
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }

    if (trimmed.startsWith('//')) {
        return `https:${trimmed}`;
    }

    if (trimmed.startsWith('/')) {
        return `${southPlusRootUrl}${trimmed}`;
    }

    return `https://${trimmed}`;
};

const extractForumId = (url: string) => {
    for (const pattern of forumUrlPatterns) {
        const match = url.match(pattern);
        if (match?.[1]) {
            return match[1];
        }
    }
};

const buildSouthPlusForumUrl = (forumId: string) => `${southPlusRootUrl}/thread.php?fid-${forumId}.html`;

const splitFilterTerms = (input: string | string[] | undefined) => {
    if (Array.isArray(input)) {
        return input
            .map((item) => item.trim())
            .filter(Boolean);
    }

    return (input ?? '')
        .split(/[\n,，;；]+/)
        .map((item) => item.trim())
        .filter(Boolean);
};

const normalizeSouthPlusFilters = (filters?: Partial<SouthPlusForwardFilters>): SouthPlusForwardFilters => ({
    includeKeywords: splitFilterTerms(filters?.includeKeywords),
    excludeKeywords: splitFilterTerms(filters?.excludeKeywords),
    includeAuthors: splitFilterTerms(filters?.includeAuthors),
    excludeAuthors: splitFilterTerms(filters?.excludeAuthors),
    includeCategories: splitFilterTerms(filters?.includeCategories),
    excludeCategories: splitFilterTerms(filters?.excludeCategories),
});

const parseSouthPlusForumInput = (input: string | undefined) => {
    const normalizedInput = normalizeSouthPlusUrl(input ?? '') || buildSouthPlusForumUrl(southPlusDefaultForumId);
    const forumId = extractForumId(normalizedInput);

    if (!forumId) {
        throw new Error('South Plus forum URL must include a forum id, for example https://south-plus.org/thread.php?fid-48.html');
    }

    return {
        forumId,
        forumUrl: buildSouthPlusForumUrl(forumId),
    };
};

const redactCookie = (cookie: string | undefined) => {
    const normalized = cookie?.trim() ?? '';
    if (!normalized) {
        return {
            cookieLength: 0,
            cookiePreview: 'Not configured',
        };
    }

    if (normalized.length <= 12) {
        return {
            cookieLength: normalized.length,
            cookiePreview: normalized,
        };
    }

    return {
        cookieLength: normalized.length,
        cookiePreview: `${normalized.slice(0, 8)}...${normalized.slice(-4)}`,
    };
};

const summarizeSouthPlusConfig = (config?: SouthPlusForwardConfig): SouthPlusForwardConfigSummary => {
    const parsed = parseSouthPlusForumInput(config?.forumUrl);
    const cookie = redactCookie(config?.cookie);
    const filters = normalizeSouthPlusFilters(config);
    const activeFilterCount = Object.values(filters).reduce((count, terms) => count + terms.length, 0);

    return {
        configured: Boolean(config?.cookie?.trim()),
        forumId: parsed.forumId,
        forumUrl: parsed.forumUrl,
        cookiePreview: cookie.cookiePreview,
        cookieLength: cookie.cookieLength,
        filters,
        activeFilterCount,
        updatedAt: config?.updatedAt,
    };
};

export { buildSouthPlusForumUrl, extractForumId, normalizeSouthPlusFilters, parseSouthPlusForumInput, redactCookie, southPlusDefaultForumId, southPlusLocalFeedPath, southPlusManagerPath, southPlusRootUrl, summarizeSouthPlusConfig };

export type { SouthPlusForwardConfig, SouthPlusForwardConfigSummary, SouthPlusForwardFilters };
