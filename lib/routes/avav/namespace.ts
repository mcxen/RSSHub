import type { Namespace } from '@/types';

export const namespace: Namespace = {
    name: 'AVAV',
    url: 'avav.best',
    description: `AVAV 视频资源站。

::: tip
RSSHub 内置 [filter](/guide/parameters#filter) 参数，可通过 \`?filter=关键词\` 只保留标题包含关键词的条目。
:::

::: tip
该站有 Cloudflare 防护，需启用 Puppeteer。
:::`,
    lang: 'zh-CN',
};
