import type { Handler } from 'hono';

import { namespaces } from '@/registry';
import type { Route } from '@/types';

const handler: Handler = (ctx) => {
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
};

export default handler;
