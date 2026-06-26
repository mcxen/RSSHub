import { describe, expect, it } from 'vitest';

import { buildSouthPlusForumUrl, normalizeSouthPlusFilters, parseSouthPlusForumInput, redactCookie, summarizeSouthPlusConfig } from './shared';

describe('south plus shared helpers', () => {
    it('parses forum id from full forum url', () => {
        expect(parseSouthPlusForumInput('https://south-plus.org/thread.php?fid-48.html')).toEqual({
            forumId: '48',
            forumUrl: buildSouthPlusForumUrl('48'),
        });
    });

    it('normalizes shorthand forum url input', () => {
        expect(parseSouthPlusForumInput('south-plus.org/thread.php?fid=208')).toEqual({
            forumId: '208',
            forumUrl: buildSouthPlusForumUrl('208'),
        });
    });

    it('redacts long cookies for ui display', () => {
        expect(redactCookie('1234567890abcdef').cookiePreview).toBe('12345678...cdef');
    });

    it('normalizes filter terms from mixed separators', () => {
        expect(
            normalizeSouthPlusFilters({
                includeKeywords: 'alpha, beta\n gamma；delta',
            }).includeKeywords
        ).toEqual(['alpha', 'beta', 'gamma', 'delta']);
    });

    it('counts active filter terms in config summary', () => {
        expect(
            summarizeSouthPlusConfig({
                cookie: 'cookie=value',
                forumUrl: buildSouthPlusForumUrl('48'),
                includeKeywords: ['alpha', 'beta'],
                excludeKeywords: [],
                includeAuthors: ['tester'],
                excludeAuthors: [],
                includeCategories: [],
                excludeCategories: [],
                updatedAt: '2026-05-27T00:00:00.000Z',
            }).activeFilterCount
        ).toBe(3);
    });
});
