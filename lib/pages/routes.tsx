import type { Handler } from 'hono';

import { namespaces } from '@/registry';
import type { Route } from '@/types';
import RoutesView from '@/views/routes';

const handler: Handler = (ctx) => {
    ctx.header('Cache-Control', 'no-cache');

    if (ctx.req.query('json') !== undefined || ctx.req.header('Accept')?.includes('application/json')) {
        const routes: Array<{
            path: string;
            name: string;
            description?: string;
            maintainers: string[];
            example: string;
            categories?: string[];
            features?: Route['features'];
        }> = [];

        for (const [nsName, nsData] of Object.entries(namespaces)) {
            if (!nsData?.routes) {
                continue;
            }
            for (const [routePath, route] of Object.entries(nsData.routes)) {
                routes.push({
                    path: `/${nsName}${routePath}`,
                    name: route.name,
                    description: route.description,
                    maintainers: route.maintainers ?? [],
                    example: route.example,
                    categories: route.categories,
                    features: route.features,
                });
            }
        }

        return ctx.json({ routes });
    }

    const baseUrl = new URL(ctx.req.url).origin;
    return ctx.html(<RoutesView baseUrl={baseUrl} />);
};

export default handler;
