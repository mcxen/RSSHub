import { getSouthPlusForumFeed } from '@/local-forward/south-plus/scraper';
import type { Route } from '@/types';

export const route: Route = {
    path: ['/local', '/forum/:fid{[0-9]+}'],
    categories: ['bbs'],
    example: '/south-plus/local',
    parameters: {
        fid: 'Forum id from South Plus URL, for example `48` from `https://south-plus.org/thread.php?fid-48.html`',
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
        nsfw: true,
    },
    name: 'Forum',
    maintainers: ['mcxen'],
    description: `Local forwarding feed for South Plus. Save your South Plus cookie in the management UI first, then subscribe to \`/south-plus/local\`.

For direct forum access without changing the saved target, use \`/south-plus/forum/:fid\`.`,
    radar: [
        {
            source: ['south-plus.org/thread.php?fid-:fid.html'],
            target: '/south-plus/forum/:fid',
        },
    ],
    handler: (ctx) => {
        const fid = ctx.req.param('fid');
        const forumUrl = fid ? `https://south-plus.org/thread.php?fid-${fid}.html` : undefined;
        return getSouthPlusForumFeed(forumUrl);
    },
};
