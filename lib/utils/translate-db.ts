import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { CacheStrategy, TranslationEngine } from './kiss-translate.js';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type StoredFeed = {
    id: string;
    name: string;
    url: string;
    sourceLang: string;
    targetLang: string;
    engine: TranslationEngine;
    paragraphMode: boolean;
    translationStrategy: CacheStrategy;
    cacheTtlMinutes: number;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
};

type TranslateConfig = {
    deepseekApiKey: string;
    deepseekBaseUrl: string;
    kissTranslateUrl: string;
};

const dbPath = path.join(import.meta.dirname, '..', 'routes', 'translate.db');
let dbInstance: DatabaseSync | undefined;

function getDb(): DatabaseSync {
    if (dbInstance) {
        return dbInstance;
    }

    dbInstance = new DatabaseSync(dbPath);
    dbInstance.exec('PRAGMA journal_mode = WAL');
    dbInstance.exec('PRAGMA busy_timeout = 3000');

    dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS feeds (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            source_lang TEXT NOT NULL DEFAULT 'auto',
            target_lang TEXT NOT NULL DEFAULT 'en',
            engine TEXT NOT NULL DEFAULT 'deepseek',
            paragraph_mode INTEGER NOT NULL DEFAULT 0,
            translation_strategy TEXT NOT NULL DEFAULT 'realtime',
            cache_ttl_minutes INTEGER NOT NULL DEFAULT 30,
            enabled INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    `);

    dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    `);

    migrateFromJson();

    return dbInstance;
}

function migrateFromJson(): void {
    const rows = dbInstance!.prepare('SELECT COUNT(*) as c FROM feeds').all() as Array<{ c: number }>;
    if (rows[0]?.c > 0) {
        return;
    }

    // Migrate feeds
    const feedsJsonPath = path.join(import.meta.dirname, '..', 'routes', 'translate-feeds.json');
    if (existsSync(feedsJsonPath)) {
        try {
            const raw = JSON.parse(readFileSync(feedsJsonPath, 'utf-8')) as Array<Record<string, unknown>>;
            const insert = dbInstance!.prepare(
                'INSERT OR IGNORE INTO feeds (id, name, url, source_lang, target_lang, engine, paragraph_mode, translation_strategy, cache_ttl_minutes, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );

            dbInstance!.exec('BEGIN');
            for (const row of raw) {
                insert.run(
                    (row.id ?? '') as string,
                    (row.name ?? '') as string,
                    (row.url ?? '') as string,
                    (row.sourceLang ?? 'auto') as string,
                    (row.targetLang ?? 'en') as string,
                    (row.engine ?? 'deepseek') as string,
                    (row.paragraphMode ? 1 : 0) as number,
                    (row.translationStrategy ?? 'realtime') as string,
                    (row.cacheTtlMinutes ?? 30) as number,
                    (row.enabled === false ? 0 : 1) as number,
                    (row.createdAt ?? new Date().toISOString()) as string,
                    (row.updatedAt ?? new Date().toISOString()) as string
                );
            }
            dbInstance!.exec('COMMIT');
        } catch {
            // JSON file corrupted or empty — skip
        }
    }

    // Migrate config
    const configJsonPath = path.join(import.meta.dirname, '..', 'routes', 'translate-config.json');
    if (existsSync(configJsonPath)) {
        try {
            const raw = JSON.parse(readFileSync(configJsonPath, 'utf-8')) as Record<string, unknown>;
            const upsert = dbInstance!.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');

            if (typeof raw.deepseekApiKey === 'string' && raw.deepseekApiKey) {
                upsert.run('deepseekApiKey', raw.deepseekApiKey);
            }
            if (typeof raw.deepseekBaseUrl === 'string' && raw.deepseekBaseUrl) {
                upsert.run('deepseekBaseUrl', raw.deepseekBaseUrl);
            }
            if (typeof raw.kissTranslateUrl === 'string' && raw.kissTranslateUrl) {
                upsert.run('kissTranslateUrl', raw.kissTranslateUrl);
            }
        } catch {
            // JSON file corrupted or empty — skip
        }
    }
}

// ---- Feeds CRUD ----

function rowToFeed(row: Record<string, unknown>): StoredFeed {
    return {
        id: row.id as string,
        name: row.name as string,
        url: row.url as string,
        sourceLang: row.source_lang as string,
        targetLang: row.target_lang as string,
        engine: row.engine as TranslationEngine,
        paragraphMode: Boolean(row.paragraph_mode),
        translationStrategy: row.translation_strategy as CacheStrategy,
        cacheTtlMinutes: row.cache_ttl_minutes as number,
        enabled: Boolean(row.enabled),
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
    };
}

export function loadStoredFeeds(): StoredFeed[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM feeds ORDER BY created_at DESC').all() as Array<Record<string, unknown>>;
    return rows.map((row) => rowToFeed(row));
}

export function saveFeed(feed: StoredFeed): void {
    const db = getDb();
    db.prepare(
        `INSERT INTO feeds (id, name, url, source_lang, target_lang, engine, paragraph_mode, translation_strategy, cache_ttl_minutes, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             url = excluded.url,
             source_lang = excluded.source_lang,
             target_lang = excluded.target_lang,
             engine = excluded.engine,
             paragraph_mode = excluded.paragraph_mode,
             translation_strategy = excluded.translation_strategy,
             cache_ttl_minutes = excluded.cache_ttl_minutes,
             enabled = excluded.enabled,
             updated_at = excluded.updated_at`
    ).run(feed.id, feed.name, feed.url, feed.sourceLang, feed.targetLang, feed.engine, feed.paragraphMode ? 1 : 0, feed.translationStrategy, feed.cacheTtlMinutes, feed.enabled ? 1 : 0, feed.createdAt, feed.updatedAt);
}

export function findFeedById(id: string): StoredFeed | undefined {
    const db = getDb();
    const row = db.prepare('SELECT * FROM feeds WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? rowToFeed(row) : undefined;
}

export function deleteFeedById(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM feeds WHERE id = ?').run(id);
    return (result.changes as number) > 0;
}

export function saveAllFeeds(feeds: StoredFeed[]): void {
    const db = getDb();
    const clear = db.prepare('DELETE FROM feeds');
    const insert = db.prepare(
        'INSERT INTO feeds (id, name, url, source_lang, target_lang, engine, paragraph_mode, translation_strategy, cache_ttl_minutes, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    db.exec('BEGIN');
    clear.run();
    for (const feed of feeds) {
        insert.run(feed.id, feed.name, feed.url, feed.sourceLang, feed.targetLang, feed.engine, feed.paragraphMode ? 1 : 0, feed.translationStrategy, feed.cacheTtlMinutes, feed.enabled ? 1 : 0, feed.createdAt, feed.updatedAt);
    }
    db.exec('COMMIT');
}

// ---- Config ----

export function loadTranslateConfig(): TranslateConfig {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM config').all() as Array<Record<string, unknown>>;
    const map: Record<string, string> = {};

    for (const row of rows) {
        map[row.key as string] = row.value as string;
    }

    return {
        deepseekApiKey: map.deepseekApiKey ?? '',
        deepseekBaseUrl: map.deepseekBaseUrl || 'https://api.deepseek.com/v1/chat/completions',
        kissTranslateUrl: map.kissTranslateUrl ?? '',
    };
}

export function saveTranslateConfig(config: TranslateConfig): void {
    const db = getDb();
    const upsert = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');

    db.exec('BEGIN');
    upsert.run('deepseekApiKey', config.deepseekApiKey);
    upsert.run('deepseekBaseUrl', config.deepseekBaseUrl);
    upsert.run('kissTranslateUrl', config.kissTranslateUrl);
    db.exec('COMMIT');
}
