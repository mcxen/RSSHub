import { readFileSync } from 'node:fs';
import path from 'node:path';

export type TranslationEngine = 'deepseek' | 'google' | 'kiss' | 'microsoft';
export type CacheStrategy = 'realtime' | 'cached' | 'scheduled';

type CacheEntry = {
    xml: string;
    createdAt: number;
    expiresAt: number;
};

const translationCache = new Map<string, CacheEntry>();

export function getCachedTranslation(id: string): string | undefined {
    const entry = translationCache.get(id);
    if (!entry) {
        return undefined;
    }
    if (Date.now() > entry.expiresAt) {
        translationCache.delete(id);
        return undefined;
    }
    return entry.xml;
}

export function setCachedTranslation(id: string, xml: string, ttlMinutes: number): void {
    const now = Date.now();
    translationCache.set(id, {
        xml,
        createdAt: now,
        expiresAt: ttlMinutes > 0 ? now + ttlMinutes * 60 * 1000 : Infinity,
    });
}

export function invalidateCache(id: string): void {
    translationCache.delete(id);
}

type BatchTranslationResult = {
    engine: TranslationEngine;
    translations: string[];
};

type DeepSeekMessage = {
    content?: string;
};

type DeepSeekChoice = {
    message?: DeepSeekMessage;
};

type DeepSeekResponse = {
    choices?: DeepSeekChoice[];
};

type TranslateConfig = {
    deepseekApiKey: string;
    deepseekBaseUrl: string;
    kissTranslateUrl: string;
};

const defaultBatchSize = 20;

function getConfigPath() {
    return path.join(import.meta.dirname, '..', 'routes', 'translate-config.json');
}

function fallbackConfig(): TranslateConfig {
    return {
        deepseekApiKey: '',
        deepseekBaseUrl: 'https://api.deepseek.com/v1/chat/completions',
        kissTranslateUrl: '',
    };
}

export function loadTranslateConfig(): TranslateConfig {
    try {
        const raw = JSON.parse(readFileSync(getConfigPath(), 'utf-8')) as Partial<TranslateConfig>;
        return {
            deepseekApiKey: raw.deepseekApiKey?.trim() ?? '',
            deepseekBaseUrl: raw.deepseekBaseUrl?.trim() || 'https://api.deepseek.com/v1/chat/completions',
            kissTranslateUrl: raw.kissTranslateUrl?.trim() ?? '',
        };
    } catch {
        return fallbackConfig();
    }
}

function getConfiguredDeepSeekApiKey() {
    const fromConfig = loadTranslateConfig().deepseekApiKey;
    if (fromConfig) {
        return fromConfig;
    }
    return process.env.DEEPSEEK_API_KEY?.trim();
}

function getConfiguredDeepSeekEndpoint() {
    return loadTranslateConfig().deepseekBaseUrl;
}

function getConfiguredKissTranslateUrl() {
    const fromConfig = loadTranslateConfig().kissTranslateUrl;
    if (fromConfig) {
        return fromConfig;
    }
    return process.env.KISS_TRANSLATE_URL?.trim();
}

export function getPreferredTranslationEngine(): TranslationEngine {
    if (getConfiguredDeepSeekApiKey()) {
        return 'deepseek';
    }

    if (getConfiguredKissTranslateUrl()) {
        return 'kiss';
    }

    return 'google';
}

function buildDeepSeekSinglePrompt(from: string, to: string) {
    return `You are a professional translator. Translate the following text from ${from} to ${to}. Reply with only the translation, no explanations.`;
}

function buildDeepSeekBatchPrompt(from: string, to: string) {
    return `You are a professional translator. Translate each array item from ${from} to ${to}. Reply with only a JSON array of translations in the same order, with no explanations.`;
}

function normalizeBatchTexts(texts: string[], from: string, to: string) {
    if (from === to) {
        return {
            passthrough: true,
            texts,
        };
    }

    return {
        passthrough: false,
        texts,
    };
}

async function googleTranslate(text: string, from: string, to: string): Promise<string> {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Google Translate request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as string[][][];
    return data[0]?.map((part) => part[0]).join('') ?? text;
}

async function googleBatchTranslate(texts: string[], from: string, to: string): Promise<BatchTranslationResult> {
    return {
        engine: 'google',
        translations: await Promise.all(texts.map((text) => googleTranslate(text, from, to))),
    };
}

let cachedMicrosoftToken: string | undefined;
let cachedMicrosoftTokenExpiry = 0;

async function getMicrosoftToken() {
    if (cachedMicrosoftToken && Date.now() < cachedMicrosoftTokenExpiry) {
        return cachedMicrosoftToken;
    }
    const response = await fetch('https://edge.microsoft.com/translate/auth');
    if (!response.ok) {
        throw new Error(`Microsoft auth failed: ${response.status}`);
    }
    cachedMicrosoftToken = await response.text();
    // Token typically expires in 10 minutes; cache for 8
    cachedMicrosoftTokenExpiry = Date.now() + 8 * 60 * 1000;
    return cachedMicrosoftToken;
}

async function microsoftTranslate(texts: string[], from: string, to: string): Promise<BatchTranslationResult> {
    const token = await getMicrosoftToken();
    const params = new URLSearchParams({ 'api-version': '3.0', from, to });
    const response = await fetch(`https://api-edge.cognitive.microsofttranslator.com/translate?${params}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(texts.map((text) => ({ Text: text }))),
    });

    if (!response.ok) {
        throw new Error(`Microsoft Translate request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Array<{ translations: Array<{ text: string }> }>;
    return {
        engine: 'microsoft',
        translations: data.map((item) => item.translations[0]?.text ?? ''),
    };
}

async function deepSeekTranslate(texts: string[], from: string, to: string): Promise<BatchTranslationResult> {
    const apiKey = getConfiguredDeepSeekApiKey();

    if (!apiKey) {
        throw new Error('DeepSeek API key is not configured.');
    }

    const response = await fetch(getConfiguredDeepSeekEndpoint(), {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                {
                    role: 'system',
                    content: texts.length === 1 ? buildDeepSeekSinglePrompt(from, to) : buildDeepSeekBatchPrompt(from, to),
                },
                {
                    role: 'user',
                    content: texts.length === 1 ? texts[0] : JSON.stringify(texts),
                },
            ],
            stream: false,
        }),
    });

    if (!response.ok) {
        throw new Error(`DeepSeek request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as DeepSeekResponse;
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
        throw new Error('DeepSeek returned an empty translation result.');
    }

    if (texts.length === 1) {
        return {
            engine: 'deepseek',
            translations: [content],
        };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch {
        throw new Error('DeepSeek batch translation returned invalid JSON.');
    }

    if (!Array.isArray(parsed) || parsed.length !== texts.length || parsed.some((entry) => typeof entry !== 'string')) {
        throw new Error('DeepSeek batch translation returned an unexpected payload.');
    }

    return {
        engine: 'deepseek',
        translations: parsed,
    };
}

function normalizeKissBatchResponse(payload: unknown, expectedLength: number) {
    if (typeof payload === 'string') {
        if (expectedLength !== 1) {
            throw new Error('KISS translation returned a single string for batch input.');
        }

        return [payload];
    }

    if (Array.isArray(payload) && payload.every((entry) => typeof entry === 'string')) {
        if (payload.length !== expectedLength) {
            throw new Error('KISS translation returned an unexpected number of results.');
        }

        return payload;
    }

    if (
        payload &&
        typeof payload === 'object' &&
        'translations' in payload &&
        Array.isArray(payload.translations) &&
        payload.translations.every((entry) => typeof entry === 'string') &&
        payload.translations.length === expectedLength
    ) {
        return payload.translations;
    }

    throw new Error('KISS translation returned an unsupported response shape.');
}

async function kissBatchTranslate(texts: string[], from: string, to: string): Promise<BatchTranslationResult> {
    const kissUrl = getConfiguredKissTranslateUrl();

    if (!kissUrl) {
        throw new Error('KISS translation URL is not configured.');
    }

    const response = await fetch(kissUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from,
            text: texts.length === 1 ? texts[0] : undefined,
            texts,
            to,
        }),
    });

    if (!response.ok) {
        throw new Error(`KISS translation request failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();

    return {
        engine: 'kiss',
        translations: normalizeKissBatchResponse(payload, texts.length),
    };
}

function getTranslationProvider(engine: TranslationEngine) {
    switch (engine) {
        case 'deepseek':
            return deepSeekTranslate;
        case 'kiss':
            return kissBatchTranslate;
        case 'google':
            return googleBatchTranslate;
        case 'microsoft':
            return microsoftTranslate;
        default:
            throw new Error(`Unknown translation engine: ${engine}`);
    }
}

async function runTranslationFallbacks(texts: string[], from: string, to: string, engine?: TranslationEngine): Promise<BatchTranslationResult> {
    const providers = [microsoftTranslate, kissBatchTranslate, googleBatchTranslate, deepSeekTranslate];

    async function attemptProvider(index: number, lastError?: Error): Promise<BatchTranslationResult> {
        const provider = providers[index];

        if (!provider) {
            throw lastError ?? new Error('Translation failed.');
        }

        try {
            return await provider(texts, from, to);
        } catch (error) {
            return attemptProvider(index + 1, error instanceof Error ? error : lastError);
        }
    }

    if (!engine) {
        return attemptProvider(0);
    }

    const preferredProvider = getTranslationProvider(engine);

    try {
        return await preferredProvider(texts, from, to);
    } catch {
        return attemptProvider(0);
    }
}

export async function batchTranslateDetailed(texts: string[], from = 'zh', to = 'en', engine?: TranslationEngine): Promise<BatchTranslationResult> {
    const { passthrough, texts: normalizedTexts } = normalizeBatchTexts(texts, from, to);

    if (normalizedTexts.length === 0) {
        return {
            engine: engine ?? getPreferredTranslationEngine(),
            translations: [],
        };
    }

    if (passthrough || normalizedTexts.every((text) => !text)) {
        return {
            engine: engine ?? getPreferredTranslationEngine(),
            translations: normalizedTexts,
        };
    }

    const slots = normalizedTexts.map((text) => (text ? -1 : -2));
    const filledTexts = normalizedTexts.filter(Boolean);
    const chunks = Array.from({ length: Math.ceil(filledTexts.length / defaultBatchSize) }, (_, index) => filledTexts.slice(index * defaultBatchSize, (index + 1) * defaultBatchSize));
    const chunkResults = await Promise.all(chunks.map((chunk) => runTranslationFallbacks(chunk, from, to, engine)));
    const engines = new Set(chunkResults.map((result) => result.engine));
    const translationsQueue = chunkResults.flatMap((result) => result.translations);
    const translations = slots.map(() => '');
    let queueIndex = 0;

    for (let index = 0; index < normalizedTexts.length; index += 1) {
        const text = normalizedTexts[index];
        translations[index] = text ? translationsQueue[queueIndex++] : text;
    }

    return {
        engine: engines.size === 1 ? chunkResults[0].engine : getPreferredTranslationEngine(),
        translations,
    };
}

export async function batchTranslate(texts: string[], from = 'zh', to = 'en', engine?: TranslationEngine): Promise<string[]> {
    const result = await batchTranslateDetailed(texts, from, to, engine);
    return result.translations;
}

export async function translate(text: string, from = 'zh', to = 'en', engine?: TranslationEngine): Promise<string> {
    if (!text || from === to) {
        return text;
    }

    try {
        const result = await batchTranslateDetailed([text], from, to, engine);
        return result.translations[0] ?? text;
    } catch {
        return text;
    }
}
