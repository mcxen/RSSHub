import type { Handler } from 'hono';

import { launchBrowserLoginAndExtractCookie } from '@/local-forward/south-plus/browser-login';
import { normalizeSouthPlusFilters, parseSouthPlusForumInput, southPlusLocalFeedPath, summarizeSouthPlusConfig } from '@/local-forward/south-plus/shared';
import { getSouthPlusConfigPath, readSouthPlusConfig, saveSouthPlusConfig } from '@/local-forward/south-plus/store';

const getHandler: Handler = async (ctx) => {
    const config = await readSouthPlusConfig();

    return ctx.json({
        code: 0,
        data: {
            config: summarizeSouthPlusConfig(config),
            feedPath: southPlusLocalFeedPath,
            configPath: getSouthPlusConfigPath(),
        },
    });
};

const postHandler: Handler = async (ctx) => {
    const existingConfig = await readSouthPlusConfig();
    const body = await ctx.req.json<{
        cookie?: string;
        forumUrl?: string;
        includeKeywords?: string | string[];
        excludeKeywords?: string | string[];
        includeAuthors?: string | string[];
        excludeAuthors?: string | string[];
        includeCategories?: string | string[];
        excludeCategories?: string | string[];
    }>();
    const cookie = body.cookie?.trim() || existingConfig.cookie.trim();

    if (!cookie) {
        return ctx.json(
            {
                code: -1,
                message: 'Cookie cannot be empty.',
            },
            400
        );
    }

    try {
        const parsed = parseSouthPlusForumInput(body.forumUrl);
        const filters = normalizeSouthPlusFilters(body);
        const saved = await saveSouthPlusConfig({
            cookie,
            forumUrl: parsed.forumUrl,
            ...filters,
            updatedAt: new Date().toISOString(),
        });

        return ctx.json({
            code: 0,
            data: {
                config: summarizeSouthPlusConfig(saved),
                feedPath: southPlusLocalFeedPath,
            },
        });
    } catch (error) {
        return ctx.json(
            {
                code: -1,
                message: error instanceof Error ? error.message : 'Unable to save South Plus configuration.',
            },
            400
        );
    }
};

const browserLoginHandler: Handler = async (ctx) => {
    const body = await ctx.req.json<{ force?: boolean }>().catch(() => ({}) as { force?: boolean });
    const result = await launchBrowserLoginAndExtractCookie(body.force);

    if (result.status === 'success' || result.status === 'busy') {
        return ctx.json({
            code: 0,
            data: result,
        });
    }

    return ctx.json(
        {
            code: -1,
            message: result.message,
        },
        400
    );
};

export { browserLoginHandler, getHandler, postHandler };
