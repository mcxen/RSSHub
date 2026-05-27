import type { Handler } from 'hono';

import { loadStoredFeeds } from '@/pages/translate-api';
import TranslateView from '@/views/translate';

const handler: Handler = (ctx) => {
    ctx.header('Cache-Control', 'no-cache');

    if (ctx.req.query('json') === '1' || ctx.req.header('Accept')?.includes('application/json')) {
        return ctx.json(loadStoredFeeds());
    }

    const baseUrl = new URL(ctx.req.url).origin;
    return ctx.html(<TranslateView baseUrl={baseUrl} />);
};

export default handler;
