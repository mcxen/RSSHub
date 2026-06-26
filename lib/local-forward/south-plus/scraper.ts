import { load } from 'cheerio';

import ConfigNotFoundError from '@/errors/types/config-not-found';
import type { Data, DataItem } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

import type { SouthPlusForwardFilters } from './shared';
import { parseSouthPlusForumInput, southPlusRootUrl } from './shared';
import { readSouthPlusConfig } from './store';

type SouthPlusThreadData = {
    item: DataItem;
    searchableText: string;
    author: string;
    category: string;
};

const joinCookies = (...cookieParts: Array<string | undefined>) =>
    cookieParts
        .map((cookiePart) => cookiePart?.trim())
        .filter(Boolean)
        .join('; ');

const fetchSouthPlusPage = async (url: string, cookie: string) => {
    let response = await ofetch.raw(url, {
        headers: {
            Cookie: cookie,
        },
    });

    const responseCookies =
        response.headers
            .getSetCookie?.()
            .map((item) => item.split(';')[0])
            .join('; ') ?? '';
    const combinedCookie = joinCookies(cookie, responseCookies);

    if (responseCookies) {
        response = await ofetch.raw(url, {
            headers: {
                Cookie: combinedCookie,
            },
        });
    }

    return {
        html: response._data as string,
        cookie: combinedCookie || cookie,
        url: response.url,
    };
};

const cleanupSouthPlusContent = ($: ReturnType<typeof load>, selector: string) => {
    const content = $(selector).first();

    content.find('script, style, .tips, .readbot').remove();
    content.find('img').each((_, image) => {
        const $image = $(image);
        const originalSrc = $image.attr('data-src') || $image.attr('src');
        if (originalSrc) {
            $image.attr('src', new URL(originalSrc, southPlusRootUrl).href);
        }
    });
    content.find('a').each((_, anchor) => {
        const $anchor = $(anchor);
        const href = $anchor.attr('href');
        if (href) {
            $anchor.attr('href', new URL(href, southPlusRootUrl).href);
        }
        $anchor.attr('target', '_blank');
    });

    return {
        html: content.html() ?? '',
        text: content.text().trim(),
    };
};

const loadSouthPlusThread = (threadUrl: string, cookie: string, category = '') =>
    cache.tryGet(threadUrl, async (): Promise<SouthPlusThreadData> => {
        const { html } = await fetchSouthPlusPage(threadUrl, cookie);
        const $ = load(html);
        const title = $('#subject_tpc').text().trim() || $('head title').text().split('|')[0].trim();
        const author = $('.js-post').first().find('a[href^="u.php?action-show-uid"]').first().text().trim();
        const pubDateText = $('.js-post').first().find('.tiptop .gray').first().text().trim();
        const content = cleanupSouthPlusContent($, '#read_tpc');
        const searchableText = [title, author, category, content.text].join('\n');

        return {
            author,
            category,
            searchableText,
            item: {
                title,
                link: threadUrl,
                author,
                pubDate: pubDateText ? timezone(parseDate(pubDateText, 'YYYY-MM-DD HH:mm'), 8) : undefined,
                description: content.html,
                ...(category
                    ? {
                          category: [category],
                      }
                    : {}),
            },
        };
    });

const matchesTermList = (value: string, terms: string[]) => {
    if (terms.length === 0) {
        return true;
    }

    const normalizedValue = value.toLowerCase();
    return terms.some((term) => normalizedValue.includes(term.toLowerCase()));
};

const matchesSouthPlusFilters = (thread: SouthPlusThreadData, filters: SouthPlusForwardFilters) => {
    if (!matchesTermList(thread.searchableText, filters.includeKeywords)) {
        return false;
    }

    if (!matchesTermList(thread.author, filters.includeAuthors)) {
        return false;
    }

    if (!matchesTermList(thread.category, filters.includeCategories)) {
        return false;
    }

    if (filters.excludeKeywords.length > 0 && matchesTermList(thread.searchableText, filters.excludeKeywords)) {
        return false;
    }

    if (filters.excludeAuthors.length > 0 && matchesTermList(thread.author, filters.excludeAuthors)) {
        return false;
    }

    if (filters.excludeCategories.length > 0 && matchesTermList(thread.category, filters.excludeCategories)) {
        return false;
    }

    return true;
};

const resolveSouthPlusForum = async (forumUrlInput?: string) => {
    const localConfig = await readSouthPlusConfig();
    const parsed = parseSouthPlusForumInput(forumUrlInput || localConfig.forumUrl);
    const cookie = localConfig.cookie.trim();

    if (!cookie) {
        throw new ConfigNotFoundError('South Plus local forwarding is not configured yet. Open /manage/south-plus and save your cookie first.');
    }

    return {
        cookie,
        filters: {
            includeKeywords: localConfig.includeKeywords,
            excludeKeywords: localConfig.excludeKeywords,
            includeAuthors: localConfig.includeAuthors,
            excludeAuthors: localConfig.excludeAuthors,
            includeCategories: localConfig.includeCategories,
            excludeCategories: localConfig.excludeCategories,
        },
        forumId: parsed.forumId,
        forumUrl: parsed.forumUrl,
    };
};

const getSouthPlusForumFeed = async (forumUrlInput?: string): Promise<Data> => {
    const { cookie, filters, forumId, forumUrl } = await resolveSouthPlusForum(forumUrlInput);
    const { html, cookie: refreshedCookie, url } = await fetchSouthPlusPage(forumUrl, cookie);
    const $ = load(html);
    const pageTitle = $('head title').text().trim();

    if (pageTitle.includes('只有注册会员才能进入') || $('body').text().includes('只有注册会员才能进入')) {
        throw new Error('The saved South Plus cookie cannot access this forum. Please update the cookie in /manage/south-plus and try again.');
    }

    const threads = await Promise.all(
        $('#ajaxtable tbody tr.tr3.t_one')
            .toArray()
            .map((row) => {
                const $row = $(row);
                const titleLink = $row.find('h3 a[id^="a_ajax_"]').first();
                const title = titleLink.text().trim();
                const href = titleLink.attr('href');

                if (!title || !href) {
                    return;
                }

                const category = $row.find('a.s8').first().text().trim();
                const threadUrl = new URL(href, southPlusRootUrl).href;
                return loadSouthPlusThread(threadUrl, refreshedCookie, category);
            })
            .filter((item): item is Promise<SouthPlusThreadData> => item !== undefined)
    );
    const items = threads.filter((thread) => matchesSouthPlusFilters(thread, filters)).map((thread) => thread.item);

    return {
        title: pageTitle || `South Plus Forum ${forumId}`,
        description: $('meta[name=description]').attr('content') || `South Plus forum ${forumId}`,
        link: url,
        item: items,
    };
};

export { getSouthPlusForumFeed };
