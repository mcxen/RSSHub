import { load } from 'cheerio';
import pMap from 'p-map';

import { config } from '@/config';
import cache from '@/utils/cache';
import logger from '@/utils/logger';
import { parseDate } from '@/utils/parse-date';
import type { Browser, Page } from '@/utils/playwright';
import { getPlaywrightPage } from '@/utils/playwright';

const allowedResourceTypes = new Set(['document', 'script', 'xhr', 'fetch', 'stylesheet', 'image']);
const cloudflareBlockedMessage = 'Cloudflare Turnstile blocked — try with a non-headless browser';

class CloudflareVerificationError extends Error {
    constructor() {
        super(cloudflareBlockedMessage);
        this.name = 'CloudflareVerificationError';
    }
}

const buildDiagnosticResponse = (url: URL, title: string, itemTitle: string, description: string) => ({
    title: `${title} - AVAV`,
    link: url.href,
    item: [
        {
            title: itemTitle,
            link: url.href,
            description,
        },
    ],
});

const setupPage = async (page: Page) => {
    await page.setUserAgent(config.trueUA);
    await page.setRequestInterception(true);
    page.on('request', (request) => {
        allowedResourceTypes.has(request.resourceType()) ? request.continue() : request.abort();
    });
};

const getBodyText = async (page: Page) => {
    try {
        return (await page.locator('body').textContent({ timeout: 5000 })) || '';
    } catch {
        return '';
    }
};

const waitForCloudflare = async (page: Page) => {
    const title = await page.title();
    const bodyText = await getBodyText(page);
    if (!title.includes('Just a moment') && !bodyText.includes('Performing security verification')) {
        return;
    }

    try {
        await page.waitForFunction(() => !document.title.includes('Just a moment') && !document.body.textContent?.includes('Performing security verification'), undefined, {
            timeout: 45000,
        });
    } catch {
        // The explicit check below returns a clearer route error than Playwright's timeout.
    }

    const currentTitle = await page.title();
    const currentBodyText = await getBodyText(page);
    if (currentTitle.includes('Just a moment') || currentBodyText.includes('Performing security verification')) {
        throw new CloudflareVerificationError();
    }
};

const itemHrefPatterns = ['/video/', '/detail/', '/watch/', '/vod/', '/voddetail/', '/vodplay/', '/movie/', '/play/', '.html'];
const ignoredHrefPatterns = ['/category/', '/type/', '/tag/', '/search', '/label/', '/topic/', '/actor/', '/director/'];

const isVideoLink = (href: string) => {
    if (!href || href === '#' || href.startsWith('javascript') || href.startsWith('mailto:')) {
        return false;
    }

    return itemHrefPatterns.some((pattern) => href.includes(pattern)) && !ignoredHrefPatterns.some((pattern) => href.includes(pattern));
};

const getItemTitle = ($, linkEl) =>
    linkEl.attr('title') ||
    linkEl.find('img').first().attr('alt') ||
    linkEl.find('.module-item-title, .module-card-item-title, .video-title, .vod-title, .title, h2, h3, h4').first().text() ||
    linkEl
        .closest('.module-item, .module-card-item, .stui-vodlist__box, .myui-vodlist__box, .vodlist_item, .video-item, .card, article, li')
        .find('.module-item-title, .module-card-item-title, .video-title, .vod-title, .title, h2, h3, h4')
        .first()
        .text() ||
    linkEl.text();

const getItemDescription = ($, linkEl) => {
    const container = linkEl.closest('.module-item, .module-card-item, .stui-vodlist__box, .myui-vodlist__box, .vodlist_item, .video-item, .card, article, li');
    const image = linkEl.find('img').first();
    const imageUrl = image.attr('data-original') || image.attr('data-src') || image.attr('src');
    const text = container.find('.module-item-note, .module-item-text, .video-desc, .vod-desc, .desc, .excerpt, p').first().text();

    if (imageUrl) {
        return `<img src="${imageUrl}">${text ? `<p>${text}</p>` : ''}`;
    }

    return text;
};

const extractDate = ($, linkEl) => {
    const container = linkEl.closest('.module-item, .module-card-item, .stui-vodlist__box, .myui-vodlist__box, .vodlist_item, .video-item, .card, article, li');
    return container.find('time[datetime]').attr('datetime') || container.find('.date, .time, [class*="date"], [class*="time"], time').first().text();
};

const waitForContent = async (page: Page) => {
    await waitForCloudflare(page);
    try {
        await page.waitForSelector('a[href*="/video/"], a[href*="/detail/"], a[href*="/vod/"], a[href*="/voddetail/"], a[href*="/vodplay/"], a[href$=".html"]', {
            timeout: 20000,
        });
    } catch {
        // The parser below still handles alternate listing markup when selectors differ.
    }
};

const openPage = async (browser: Browser, link: string) => {
    const page = await browser.newPage();
    await setupPage(page);
    await page.goto(link, {
        waitUntil: 'domcontentloaded',
    });
    await waitForContent(page);
    return page;
};

const processItems = async (ctx, path, title) => {
    const domain = ctx.req.query('domain') ?? 'avav.best';
    const url = new URL(path, `https://${domain}`);

    logger.http(`[avav] Requesting ${url.href}`);

    let destroy;
    try {
        const {
            page,
            destroy: closeBrowser,
            browser,
        } = await getPlaywrightPage(url.href, {
            closeTimeout: 120000,
            onBeforeLoad: setupPage,
        });
        destroy = closeBrowser;

        await waitForContent(page);
        const response = await page.content();
        await page.close();

        const $ = load(response);
        const rootUrl = `https://${domain}`;

        let items = $('a[href]')
            .filter((_, el) => {
                const linkEl = $(el);
                const href = linkEl.attr('href') || '';
                const hasListingMarker = linkEl.find('img').length > 0 || /video|vod|movie|pic|thumb|module|item|card|post/.test(linkEl.attr('class') || linkEl.parent().attr('class') || '');
                return isVideoLink(href) && hasListingMarker;
            })
            .slice(0, ctx.req.query('limit') ? Number.parseInt(ctx.req.query('limit')) : 20)
            .toArray()
            .map((el) => {
                const linkEl = $(el);
                const href = linkEl.attr('href') || '';
                const pubDate = extractDate($, linkEl);

                return {
                    title: getItemTitle($, linkEl).trim(),
                    link: new URL(href, rootUrl).href,
                    pubDate: pubDate ? parseDate(pubDate) : undefined,
                    description: getItemDescription($, linkEl),
                };
            })
            .filter((item, index, array) => item.title && array.findIndex((current) => current.link === item.link) === index);

        if (items.length === 0) {
            return buildDiagnosticResponse(
                url,
                title,
                'No AVAV items found',
                `No video items were found on this page. The site may be blocking RSSHub with Cloudflare Turnstile or robots.txt; open ${url.href} and https://${domain}/robots.txt in a browser to check access.`
            );
        }

        // Fetch detail pages with cache
        items = await pMap(
            items,
            (item) =>
                cache.tryGet(item.link, async () => {
                    let detailPage;
                    try {
                        logger.http(`[avav] Detail: ${item.link}`);
                        detailPage = await openPage(browser, item.link);
                        const detailResponse = await detailPage.content();
                        const $d = load(detailResponse);

                        // Update title from detail page if more specific
                        const detailTitle = $d('h1, [class*="title"]').first().text().trim();
                        if (detailTitle) {
                            item.title = detailTitle;
                        }

                        // Extract description/brief content
                        const descEl = $d('[class*="desc"], [class*="intro"], [class*="content"], article, .entry-content');
                        if (descEl.length) {
                            item.description = descEl.first().html() || descEl.first().text() || item.description;
                        }

                        // Extract categories/tags
                        item.category = $d('[class*="tag"], [class*="category"], [rel="tag"]')
                            .toArray()
                            .map((tag) => $d(tag).text().trim())
                            .filter(Boolean);

                        // Extract enclosure if video/magnet link exists
                        const videoSrc = $d('video source, video[src]').attr('src') || $d('a[href$=".mp4"], a[href$=".m3u8"]').first().attr('href');
                        if (videoSrc) {
                            item.enclosure_url = new URL(videoSrc, item.link).href;
                            item.enclosure_type = videoSrc.endsWith('.m3u8') ? 'application/x-mpegURL' : 'video/mp4';
                        }

                        // Extract pubDate if available on detail page
                        const detailDate = $d('time[datetime]').attr('datetime') || $d('[class*="date"], [class*="time"]').first().text();
                        if (detailDate && !Number.isNaN(Date.parse(detailDate))) {
                            item.pubDate = parseDate(detailDate);
                        }
                    } catch (error: any) {
                        logger.error(`[avav] Failed to fetch detail: ${item.link} - ${error.message}`);
                    } finally {
                        if (detailPage && !detailPage.isClosed()) {
                            await detailPage.close();
                        }
                    }

                    return item;
                }),
            {
                concurrency: 3,
            }
        );

        return {
            title: `${$('title').text().trim() || title} - AVAV`,
            link: url.href,
            item: items.filter((item) => item.title),
        };
    } catch (error) {
        if (error instanceof CloudflareVerificationError) {
            return buildDiagnosticResponse(url, title, cloudflareBlockedMessage, `${cloudflareBlockedMessage}. Open ${url.href} in a non-headless browser to complete verification before retrying RSSHub.`);
        }

        throw error;
    } finally {
        if (destroy) {
            await destroy();
        }
    }
};

export default { processItems };
