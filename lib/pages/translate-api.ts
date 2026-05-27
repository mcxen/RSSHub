import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { convert } from 'html-to-text';
import Parser from 'rss-parser';

import { batchTranslate, batchTranslateDetailed, type CacheStrategy, getCachedTranslation, invalidateCache, loadTranslateConfig, setCachedTranslation, type TranslationEngine } from '@/utils/kiss-translate';

type StoredFeed = {
    id: string;
    name: string;
    url: string;
    sourceLang: string;
    targetLang: string;
    engine: TranslationEngine;
    paragraphMode: boolean;
    translationStrategy: 'realtime' | 'cached' | 'scheduled';
    cacheTtlMinutes: number;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
};

type PreviewItem = {
    originalTitle: string;
    translatedTitle: string;
    originalDesc: string;
    translatedDesc: string;
};

type PreviewResponse = {
    engine: TranslationEngine | 'mixed';
    itemCount: number;
    items: PreviewItem[];
    title: string;
};

type ParsedFeedItem = {
    title?: string;
    link?: string;
    pubDate?: string;
    isoDate?: string;
    creator?: string;
    author?: string;
    content?: string;
    contentSnippet?: string;
    summary?: string;
    categories?: string[];
};

type ParsedFeed = {
    title?: string;
    link?: string;
    description?: string;
    language?: string;
    pubDate?: string;
    lastBuildDate?: string;
    items: ParsedFeedItem[];
};

const parser = new Parser();
const feedsPath = path.join(import.meta.dirname, '..', 'routes', 'translate-feeds.json');
const configPath = path.join(import.meta.dirname, '..', 'routes', 'translate-config.json');
const previewLimit = 3;
const translationChunkSize = 20;

function isDefined<T>(value: T | undefined): value is T {
    return value !== undefined;
}

function loadStoredFeeds(): StoredFeed[] {
    try {
        const feeds = JSON.parse(readFileSync(feedsPath, 'utf-8')) as Array<StoredFeed | Omit<StoredFeed, 'engine' | 'paragraphMode' | 'translationStrategy' | 'cacheTtlMinutes'>>;
        return feeds.map((feed) => ({
            ...feed,
            engine: 'engine' in feed && feed.engine ? feed.engine : 'deepseek',
            paragraphMode: 'paragraphMode' in feed ? Boolean(feed.paragraphMode) : false,
            translationStrategy: 'translationStrategy' in feed ? feed.translationStrategy : 'realtime',
            cacheTtlMinutes: 'cacheTtlMinutes' in feed ? feed.cacheTtlMinutes : 30,
        }));
    } catch {
        return [];
    }
}

function saveStoredFeeds(feeds: StoredFeed[]) {
    writeFileSync(feedsPath, JSON.stringify(feeds, null, 2) + '\n', 'utf-8');
}

function validateFeedUrl(value: string) {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error('Feed URL must be a valid absolute URL.');
    }

    if (!(url.protocol === 'http:' || url.protocol === 'https:')) {
        throw new Error('Feed URL must start with http:// or https://.');
    }
}

function normalizeLanguage(value: string | undefined, fallback: string) {
    const normalized = value?.trim().toLowerCase();
    return normalized || fallback;
}

function normalizeTranslationEngine(value: string | undefined, fallback: TranslationEngine) {
    switch (value?.trim().toLowerCase()) {
        case 'deepseek':
        case 'google':
        case 'kiss':
        case 'microsoft':
            return value.trim().toLowerCase() as TranslationEngine;
        default:
            return fallback;
    }
}

function extractDescription(item: ParsedFeedItem) {
    return item.content ?? item.summary ?? item.contentSnippet ?? '';
}

function htmlToPlainText(value: string) {
    if (!value) {
        return '';
    }

    return convert(value, {
        selectors: [
            { selector: 'a', options: { ignoreHref: true } },
            { selector: 'img', format: 'skip' },
        ],
        wordwrap: false,
    }).trim();
}

function splitIntoParagraphs(value: string) {
    if (!value) {
        return [];
    }

    return value
        .replaceAll('\r\n', '\n')
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);
}

function sanitizeCdata(value: string) {
    return value.replaceAll(']]>', ']]]]><![CDATA[>');
}

function xmlEscape(value: string) {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function buildTranslatedDescription(translatedText: string, originalHtml: string) {
    const translatedBlock = translatedText ? `<section><h3>Translated</h3><p>${xmlEscape(translatedText)}</p></section>` : '';
    const originalBlock = originalHtml ? `<section><h3>Original</h3>${originalHtml}</section>` : '';
    return `<![CDATA[${sanitizeCdata(`${translatedBlock}${originalBlock}`)}]]>`;
}

async function fetchFeedXml(url: string) {
    const response = await fetch(url, {
        headers: {
            Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        },
    });

    if (!response.ok) {
        throw new Error(`Unable to fetch RSS feed: ${response.status} ${response.statusText}`);
    }

    return await response.text();
}

async function parseFeed(url: string): Promise<ParsedFeed> {
    validateFeedUrl(url);
    const xml = await fetchFeedXml(url);
    const parsed = (await parser.parseString(xml)) as ParsedFeed;

    return {
        ...parsed,
        items: parsed.items ?? [],
    };
}

function createPreviewItem(item: ParsedFeedItem) {
    return {
        originalDesc: htmlToPlainText(extractDescription(item)),
        originalTitle: item.title ?? '',
        translatedDesc: '',
        translatedTitle: '',
    } satisfies PreviewItem;
}

function getPreviewEngine(engines: TranslationEngine[]) {
    return new Set(engines).size === 1 ? engines[0] : 'mixed';
}

async function translatePreviewItems(items: ParsedFeedItem[], sourceLang: string, targetLang: string, engine?: TranslationEngine, paragraphMode = false): Promise<PreviewResponse> {
    const previews = items.map((item) => createPreviewItem(item));
    const results = await Promise.all(
        previews.map(async (item) => {
            const descriptionTexts = paragraphMode ? splitIntoParagraphs(item.originalDesc) : item.originalDesc ? [item.originalDesc] : [];
            const texts = [item.originalTitle, ...descriptionTexts].filter(Boolean);
            if (texts.length === 0) {
                return { engine: 'google' as TranslationEngine, item };
            }

            const result = await batchTranslateDetailed(texts, sourceLang, targetLang, engine);
            const titleOffset = item.originalTitle ? 1 : 0;
            const translatedTitle = item.originalTitle ? (result.translations[0] ?? '') : '';
            const translatedDesc = paragraphMode ? result.translations.slice(titleOffset, titleOffset + descriptionTexts.length).join('\n\n') : item.originalDesc ? (result.translations[titleOffset] ?? '') : '';

            return {
                engine: result.engine,
                item: {
                    ...item,
                    translatedDesc,
                    translatedTitle,
                },
            };
        })
    );

    return {
        engine: getPreviewEngine(results.map((result) => result.engine)),
        itemCount: items.length,
        items: results.map((result) => result.item),
        title: '',
    };
}

async function translatePreviewItemsStream(
    items: ParsedFeedItem[],
    sourceLang: string,
    targetLang: string,
    engine: TranslationEngine | undefined,
    onItem: (index: number, item: PreviewItem, engine: TranslationEngine) => void | Promise<void>,
    paragraphMode = false
) {
    const previews = items.map((item) => createPreviewItem(item));
    const translations = await Promise.all(
        previews.map(async (item, index) => {
            const descriptionTexts = paragraphMode ? splitIntoParagraphs(item.originalDesc) : item.originalDesc ? [item.originalDesc] : [];
            const texts = [item.originalTitle, ...descriptionTexts].filter(Boolean);
            if (texts.length === 0) {
                await onItem(index, item, 'google');
                return { engine: 'google' as TranslationEngine, index, item };
            }

            const result = await batchTranslateDetailed(texts, sourceLang, targetLang, engine);
            const titleOffset = item.originalTitle ? 1 : 0;
            const translatedTitle = item.originalTitle ? (result.translations[0] ?? '') : '';
            const translatedDesc = paragraphMode ? result.translations.slice(titleOffset, titleOffset + descriptionTexts.length).join('\n\n') : item.originalDesc ? (result.translations[titleOffset] ?? '') : '';
            const translatedItem = {
                ...item,
                translatedDesc,
                translatedTitle,
            };

            await onItem(index, translatedItem, result.engine);

            return {
                engine: result.engine,
                index,
                item: translatedItem,
            };
        })
    );

    return {
        engine: getPreviewEngine(translations.map((result) => result.engine)),
        items: translations.toSorted((left, right) => left.index - right.index).map((result) => result.item),
    };
}

type TranslationChunkEntry = {
    index: number;
    kind: 'title' | 'description';
    text: string;
    paragraphCount?: number;
    paragraphIndex?: number;
};

function buildTranslationChunks(items: ParsedFeedItem[], paragraphMode = false) {
    const entries = items.flatMap((item, index) => {
        const originalDescriptionText = htmlToPlainText(extractDescription(item));
        const descriptionEntries = paragraphMode
            ? splitIntoParagraphs(originalDescriptionText).map(
                  (paragraph, paragraphIndex, paragraphs) =>
                      ({
                          index,
                          kind: 'description' as const,
                          paragraphCount: paragraphs.length,
                          paragraphIndex,
                          text: paragraph,
                      }) satisfies TranslationChunkEntry
              )
            : originalDescriptionText
              ? [
                    {
                        index,
                        kind: 'description' as const,
                        text: originalDescriptionText,
                    } satisfies TranslationChunkEntry,
                ]
              : [];

        return [
            item.title
                ? ({
                      index,
                      kind: 'title' as const,
                      text: item.title,
                  } satisfies TranslationChunkEntry)
                : undefined,
            ...descriptionEntries,
        ].filter((entry) => isDefined(entry));
    });

    return Array.from({ length: Math.ceil(entries.length / translationChunkSize) }, (_, index) => entries.slice(index * translationChunkSize, (index + 1) * translationChunkSize));
}

async function buildTranslatedFeedXml(feed: ParsedFeed, config: StoredFeed) {
    const translatedValues = feed.items.map(() => ({
        description: '',
        descriptionParagraphs: [] as string[],
        title: '',
    }));
    const chunks = buildTranslationChunks(feed.items, config.paragraphMode);
    const chunkResults = await Promise.all(
        chunks.map(async (chunk) => {
            const translations = await batchTranslate(
                chunk.map((entry) => entry.text),
                config.sourceLang,
                config.targetLang,
                config.engine
            );
            return {
                chunk,
                translations,
            };
        })
    );

    for (const { chunk, translations } of chunkResults) {
        for (let translationIndex = 0; translationIndex < chunk.length; translationIndex += 1) {
            const entry = chunk[translationIndex];
            if (entry.kind === 'title') {
                translatedValues[entry.index].title = translations[translationIndex] ?? '';
            } else if (config.paragraphMode && entry.paragraphIndex !== undefined) {
                translatedValues[entry.index].descriptionParagraphs[entry.paragraphIndex] = translations[translationIndex] ?? '';
            } else {
                translatedValues[entry.index].description = translations[translationIndex] ?? '';
            }
        }
    }

    const titlePrefix = config.targetLang.startsWith('zh') ? '[译文] ' : '[Translated] ';
    const translatedItems = feed.items.map((item, index) => {
        const originalTitle = item.title ?? '';
        const originalDescriptionHtml = extractDescription(item);
        const translatedTitle = translatedValues[index].title;
        let descriptionXml: string;
        if (config.paragraphMode) {
            const originalParagraphs = splitIntoParagraphs(htmlToPlainText(originalDescriptionHtml));
            const translatedParagraphs = translatedValues[index].descriptionParagraphs;
            const blocks: string[] = [];
            const count = Math.max(originalParagraphs.length, translatedParagraphs.length);
            for (let pi = 0; pi < count; pi += 1) {
                const orig = originalParagraphs[pi] ?? '';
                const tran = translatedParagraphs[pi] ?? '';
                blocks.push(`<section><h3>Original</h3><p>${xmlEscape(orig)}</p></section>` + `<section><h3>Translated</h3><p>${xmlEscape(tran)}</p></section>`);
            }
            descriptionXml = `<![CDATA[${sanitizeCdata(blocks.join(''))}]]>`;
        } else {
            const translatedDescription = translatedValues[index].description;
            descriptionXml = buildTranslatedDescription(translatedDescription, originalDescriptionHtml);
        }
        const title = xmlEscape(translatedTitle || originalTitle || 'Untitled');
        const link = item.link ? `<link>${xmlEscape(item.link)}</link>` : '';
        const guidValue = item.link ?? `translate:${config.id}:${originalTitle}:${item.pubDate ?? ''}`;
        const pubDate = item.pubDate ?? item.isoDate;
        const author = item.creator ?? item.author;
        const categoryXml = (item.categories ?? []).map((category) => `<category>${xmlEscape(category)}</category>`).join('');

        return `<item>
<title>${xmlEscape(titlePrefix)}${title}</title>
${link}
<guid>${xmlEscape(guidValue)}</guid>
${pubDate ? `<pubDate>${xmlEscape(pubDate)}</pubDate>` : ''}
${author ? `<author>${xmlEscape(author)}</author>` : ''}
${categoryXml}
<description>${descriptionXml}</description>
</item>`;
    });

    const feedTitlePrefix = config.targetLang.startsWith('zh') ? '[译文] ' : '[Translated] ';
    const channelLink = feed.link || config.url;
    const channelDescription = feed.description ?? `Translated feed for ${config.url}`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>${xmlEscape(feedTitlePrefix + (feed.title ?? config.name))}</title>
<link>${xmlEscape(channelLink)}</link>
<description>${xmlEscape(channelDescription)}</description>
${feed.language ? `<language>${xmlEscape(config.targetLang || feed.language)}</language>` : ''}
${(feed.lastBuildDate ?? feed.pubDate) ? `<lastBuildDate>${xmlEscape(feed.lastBuildDate ?? feed.pubDate ?? '')}</lastBuildDate>` : ''}
<generator>RSSHub Translate Console</generator>
${translatedItems.join('\n')}
</channel>
</rss>`;
}

async function readJsonBody<T>(ctx: Context): Promise<T> {
    return (await ctx.req.json()) as T;
}

function jsonError(ctx: Context, status: number, message: string) {
    ctx.status(status as ContentfulStatusCode);
    return ctx.json({ error: message });
}

function encodeJsonLine(value: unknown) {
    return new TextEncoder().encode(JSON.stringify(value) + '\n');
}

async function preview(ctx: Context) {
    try {
        const body = await readJsonBody<{ engine?: string; paragraphMode?: boolean; url?: string; sourceLang?: string; targetLang?: string }>(ctx);
        const url = body.url?.trim() ?? '';
        const sourceLang = normalizeLanguage(body.sourceLang, 'auto');
        const targetLang = normalizeLanguage(body.targetLang, 'en');
        const engine = normalizeTranslationEngine(body.engine, 'deepseek');
        const paragraphMode = Boolean(body.paragraphMode);

        validateFeedUrl(url);
        const feed = await parseFeed(url);
        const previewItems = feed.items.slice(0, previewLimit);

        if (ctx.req.query('stream') === '1') {
            const stream = new ReadableStream({
                start(controller) {
                    void (async () => {
                        try {
                            controller.enqueue(
                                encodeJsonLine({
                                    itemCount: feed.items.length,
                                    title: feed.title ?? '',
                                    type: 'meta',
                                })
                            );

                            const translated = await translatePreviewItemsStream(
                                previewItems,
                                sourceLang,
                                targetLang,
                                engine,
                                (index, item, engine) => {
                                    controller.enqueue(
                                        encodeJsonLine({
                                            engine,
                                            index,
                                            item,
                                            type: 'item',
                                        })
                                    );
                                },
                                paragraphMode
                            );

                            controller.enqueue(
                                encodeJsonLine({
                                    engine: translated.engine,
                                    itemCount: feed.items.length,
                                    items: translated.items,
                                    title: feed.title ?? '',
                                    type: 'done',
                                })
                            );
                            controller.close();
                        } catch (error) {
                            controller.enqueue(
                                encodeJsonLine({
                                    error: error instanceof Error ? error.message : 'Preview failed.',
                                    type: 'error',
                                })
                            );
                            controller.close();
                        }
                    })();
                },
            });

            ctx.header('Cache-Control', 'no-cache');
            ctx.header('Content-Type', 'application/x-ndjson; charset=utf-8');
            return ctx.body(stream);
        }

        const result = await translatePreviewItems(previewItems, sourceLang, targetLang, engine, paragraphMode);

        return ctx.json({
            engine: result.engine,
            itemCount: feed.items.length,
            items: result.items,
            title: feed.title ?? '',
        });
    } catch (error) {
        return jsonError(ctx, 400, error instanceof Error ? error.message : 'Preview failed.');
    }
}

async function saveFeed(ctx: Context) {
    try {
        const body = await readJsonBody<Partial<StoredFeed>>(ctx);
        const id = body.id?.trim();
        const feeds = loadStoredFeeds();
        const now = new Date().toISOString();
        const targetLang = normalizeLanguage(body.targetLang, 'en');
        const sourceLang = normalizeLanguage(body.sourceLang, 'auto');
        const paragraphMode = body.paragraphMode ?? false;

        if (id) {
            const index = feeds.findIndex((feed) => feed.id === id);
            if (index === -1) {
                return jsonError(ctx, 404, 'Saved translation config not found.');
            }

            const existing = feeds[index];
            const nextFeed: StoredFeed = {
                ...existing,
                name: body.name?.trim() || existing.name,
                url: body.url?.trim() || existing.url,
                sourceLang: normalizeLanguage(body.sourceLang, existing.sourceLang),
                targetLang: normalizeLanguage(body.targetLang, existing.targetLang),
                engine: normalizeTranslationEngine(body.engine, existing.engine),
                paragraphMode,
                translationStrategy: (body.translationStrategy as CacheStrategy | undefined) ?? existing.translationStrategy ?? 'realtime',
                cacheTtlMinutes: typeof body.cacheTtlMinutes === 'number' ? body.cacheTtlMinutes : (existing.cacheTtlMinutes ?? 30),
                enabled: body.enabled ?? existing.enabled,
                updatedAt: now,
            };

            validateFeedUrl(nextFeed.url);
            feeds[index] = nextFeed;
            invalidateCache(nextFeed.id);
            saveStoredFeeds(feeds);
            return ctx.json(nextFeed);
        }

        const name = body.name?.trim() ?? '';
        const url = body.url?.trim() ?? '';
        const engine = normalizeTranslationEngine(body.engine, 'deepseek');

        if (!name) {
            return jsonError(ctx, 400, 'Feed Name is required.');
        }
        validateFeedUrl(url);

        const nextFeed: StoredFeed = {
            id: crypto.randomUUID(),
            name,
            url,
            sourceLang,
            targetLang,
            engine,
            paragraphMode,
            translationStrategy: (body.translationStrategy as CacheStrategy | undefined) ?? 'realtime',
            cacheTtlMinutes: typeof body.cacheTtlMinutes === 'number' ? body.cacheTtlMinutes : 30,
            enabled: body.enabled ?? true,
            createdAt: now,
            updatedAt: now,
        };

        feeds.unshift(nextFeed);
        saveStoredFeeds(feeds);
        return ctx.json(nextFeed, { status: 201 });
    } catch (error) {
        return jsonError(ctx, 400, error instanceof Error ? error.message : 'Unable to save translation config.');
    }
}

function listFeeds(ctx: Context) {
    return ctx.json(loadStoredFeeds());
}

function deleteFeed(ctx: Context) {
    const id = ctx.req.param('id');
    const feeds = loadStoredFeeds();
    const nextFeeds = feeds.filter((feed) => feed.id !== id);

    if (nextFeeds.length === feeds.length) {
        return jsonError(ctx, 404, 'Saved translation config not found.');
    }

    saveStoredFeeds(nextFeeds);
    return ctx.json({ ok: true });
}

async function getFeed(ctx: Context) {
    try {
        const id = ctx.req.param('id');
        const storedFeed = loadStoredFeeds().find((feed) => feed.id === id);

        if (!storedFeed) {
            return ctx.text('Saved translation config not found.', 404);
        }

        if (!storedFeed.enabled) {
            return ctx.text('This translated feed is currently disabled.', 409);
        }

        const strategy: CacheStrategy = storedFeed.translationStrategy ?? 'realtime';
        const ttl = storedFeed.cacheTtlMinutes ?? 30;

        // Cached or Scheduled: try cache first
        if (strategy === 'cached' || strategy === 'scheduled') {
            const cachedXml = getCachedTranslation(id);
            if (cachedXml) {
                ctx.header('Content-Type', 'application/rss+xml; charset=utf-8');
                ctx.header('Cache-Control', 'public, max-age=60');
                ctx.header('X-Translate-Cache', 'HIT');
                return ctx.body(cachedXml);
            }
            // Scheduled mode: no cache = no live translation
            if (strategy === 'scheduled') {
                return ctx.text('This feed uses scheduled translation. No cached translation available yet. Use /translate/api/refresh/' + id + ' to generate one.', 503);
            }
        }

        // Realtime or Cached (cache miss): translate live
        const sourceFeed = await parseFeed(storedFeed.url);
        const xml = await buildTranslatedFeedXml(sourceFeed, storedFeed);

        // Cache for non-realtime strategies
        if (strategy === 'cached' || strategy === 'scheduled') {
            setCachedTranslation(id, xml, strategy === 'scheduled' ? 0 : ttl);
        }

        ctx.header('Content-Type', 'application/rss+xml; charset=utf-8');
        ctx.header('Cache-Control', strategy === 'realtime' ? 'no-cache' : 'public, max-age=60');
        ctx.header('X-Translate-Cache', strategy === 'realtime' ? 'MISS (realtime)' : 'MISS');
        return ctx.body(xml);
    } catch (error) {
        return ctx.text(error instanceof Error ? error.message : 'Unable to build translated feed.', 500);
    }
}

async function refreshFeed(ctx: Context) {
    try {
        const id = ctx.req.param('id');
        const storedFeed = loadStoredFeeds().find((feed) => feed.id === id);

        if (!storedFeed) {
            return ctx.text('Saved translation config not found.', 404);
        }

        // Always invalidate old cache and rebuild
        invalidateCache(id);
        const strategy: CacheStrategy = storedFeed.translationStrategy ?? 'realtime';
        const ttl = storedFeed.cacheTtlMinutes ?? 30;
        const sourceFeed = await parseFeed(storedFeed.url);
        const xml = await buildTranslatedFeedXml(sourceFeed, storedFeed);

        // Cache the result
        setCachedTranslation(id, xml, strategy === 'scheduled' ? 0 : ttl);

        ctx.header('Content-Type', 'application/rss+xml; charset=utf-8');
        return ctx.body(xml);
    } catch (error) {
        return ctx.text(error instanceof Error ? error.message : 'Unable to refresh translated feed.', 500);
    }
}

function getConfig(ctx: Context) {
    const config = loadTranslateConfig();
    const maskedKey = config.deepseekApiKey ? config.deepseekApiKey.slice(0, 4) + '••••' + config.deepseekApiKey.slice(-4) : '';
    return ctx.json({
        deepseekApiKey: maskedKey,
        deepseekApiKeySet: Boolean(config.deepseekApiKey),
        deepseekBaseUrl: config.deepseekBaseUrl,
        kissTranslateUrl: config.kissTranslateUrl,
        kissTranslateUrlSet: Boolean(config.kissTranslateUrl),
    });
}

async function saveConfig(ctx: Context) {
    try {
        const body = await readJsonBody<{
            deepseekApiKey?: string;
            deepseekBaseUrl?: string;
            kissTranslateUrl?: string;
        }>(ctx);

        const existing = loadTranslateConfig();
        const nextConfig = {
            deepseekApiKey: body.deepseekApiKey === undefined ? existing.deepseekApiKey : body.deepseekApiKey.trim(),
            deepseekBaseUrl: body.deepseekBaseUrl?.trim() || existing.deepseekBaseUrl,
            kissTranslateUrl: body.kissTranslateUrl === undefined ? existing.kissTranslateUrl : body.kissTranslateUrl.trim(),
        };

        writeFileSync(configPath, JSON.stringify(nextConfig, null, 2) + '\n', 'utf-8');
        return ctx.json({ ok: true });
    } catch (error) {
        return jsonError(ctx, 400, error instanceof Error ? error.message : 'Unable to save config.');
    }
}

export { deleteFeed, getConfig, getFeed, listFeeds, loadStoredFeeds, preview, refreshFeed, saveConfig, saveFeed };

export default {
    deleteFeed,
    getConfig,
    getFeed,
    listFeeds,
    preview,
    refreshFeed,
    saveConfig,
    saveFeed,
};
