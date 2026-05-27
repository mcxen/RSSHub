const southPlusRootUrl = 'https://south-plus.org';
const southPlusDefaultForumId = '48';
const southPlusLocalFeedPath = '/south-plus/local';
const southPlusManagerPath = '/manage/south-plus';

type SouthPlusForwardConfig = {
    cookie: string;
    forumUrl: string;
    updatedAt: string;
};

type SouthPlusForwardConfigSummary = {
    configured: boolean;
    forumId: string;
    forumUrl: string;
    cookiePreview: string;
    cookieLength: number;
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

    return {
        configured: Boolean(config?.cookie?.trim()),
        forumId: parsed.forumId,
        forumUrl: parsed.forumUrl,
        cookiePreview: cookie.cookiePreview,
        cookieLength: cookie.cookieLength,
        updatedAt: config?.updatedAt,
    };
};

export { buildSouthPlusForumUrl, extractForumId, parseSouthPlusForumInput, redactCookie, southPlusDefaultForumId, southPlusLocalFeedPath, southPlusManagerPath, southPlusRootUrl, summarizeSouthPlusConfig };

export type { SouthPlusForwardConfig, SouthPlusForwardConfigSummary };
