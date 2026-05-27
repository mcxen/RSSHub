import type { Handler } from 'hono';

import { parseSouthPlusForumInput, southPlusLocalFeedPath, summarizeSouthPlusConfig } from '@/local-forward/south-plus/shared';
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
    const body = await ctx.req.json<{ cookie?: string; forumUrl?: string }>();
    const cookie = body.cookie?.trim() ?? '';

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
        const saved = await saveSouthPlusConfig({
            cookie,
            forumUrl: parsed.forumUrl,
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

export { getHandler, postHandler };
