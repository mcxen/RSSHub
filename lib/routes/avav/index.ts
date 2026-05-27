import type { Route } from '@/types';

import utils from './utils';

export const route: Route = {
    path: '/',
    categories: ['multimedia'],
    example: '/avav',
    parameters: {},
    features: {
        requirePuppeteer: true,
        antiCrawler: true,
        nsfw: true,
    },
    radar: [
        {
            source: ['avav.best/'],
            target: '',
        },
    ],
    name: '首页',
    maintainers: ['mcxen'],
    handler,
    url: 'avav.best/',
    description: 'AVAV 主页最新视频列表。支持 RSSHub 通用过滤参数：`?filter=关键词` 只保留标题包含关键词的条目。',
};

async function handler(ctx) {
    const title = '最新视频';
    return await utils.processItems(ctx, '/', title);
}
