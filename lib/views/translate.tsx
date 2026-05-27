import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { FC } from 'hono/jsx';

import { getPreferredTranslationEngine, type TranslationEngine } from '@/utils/kiss-translate';
import { Layout } from '@/views/layout';

const jisThemeCss = readFileSync(path.join(import.meta.dirname, 'jis-theme.css'), 'utf-8');

const languageOptions = [
    { label: 'Auto Detect', value: 'auto' },
    { label: 'Chinese', value: 'zh' },
    { label: 'English', value: 'en' },
    { label: 'Japanese', value: 'ja' },
    { label: 'Korean', value: 'ko' },
    { label: 'French', value: 'fr' },
    { label: 'German', value: 'de' },
    { label: 'Spanish', value: 'es' },
];

const translationEngines: Array<{ label: string; value: TranslationEngine }> = [
    { label: 'DeepSeek', value: 'deepseek' },
    { label: 'KISS API', value: 'kiss' },
    { label: 'Google', value: 'google' },
    { label: 'Microsoft', value: 'microsoft' },
];

const interactionScript = `
    (() => {
        const state = {
            baseUrl: window.__TRANSLATE_CONSOLE__.baseUrl,
            preferredEngine: window.__TRANSLATE_CONSOLE__.preferredEngine,
            editingFeedId: '',
            editingFeedEnabled: true,
            openFeedId: '',
            preview: null,
            savedFeeds: [],
            apiConfig: null,
            apiConfigPanelOpen: false,
        };

        const elements = {
            form: document.getElementById('translate-form'),
            previewButton: document.getElementById('preview-button'),
            saveButton: document.getElementById('save-button'),
            previewPanel: document.getElementById('preview-panel'),
            previewMeta: document.getElementById('preview-meta'),
            previewItems: document.getElementById('preview-items'),
            previewEngine: document.getElementById('preview-engine'),
            savedList: document.getElementById('saved-feeds-list'),
            savedEmpty: document.getElementById('saved-feeds-empty'),
            status: document.getElementById('translate-status'),
            feedName: document.getElementById('feed-name'),
            feedUrl: document.getElementById('feed-url'),
            sourceLang: document.getElementById('source-lang'),
            targetLang: document.getElementById('target-lang'),
            engine: document.getElementById('translation-engine'),
            paragraphMode: document.getElementById('paragraph-mode'),
            translationStrategy: document.getElementById('translation-strategy'),
            cacheTtl: document.getElementById('cache-ttl'),
            cacheTtlWrapper: document.getElementById('cache-ttl-wrapper'),
            apiConfigPanel: document.getElementById('api-config-panel'),
            toggleApiConfig: document.getElementById('toggle-api-config'),
            deepseekApiKey: document.getElementById('deepseek-api-key'),
            deepseekBaseUrl: document.getElementById('deepseek-base-url'),
            kissTranslateUrl: document.getElementById('kiss-translate-url'),
            saveApiConfig: document.getElementById('save-api-config'),
            apiConfigStatus: document.getElementById('api-config-status'),
            apiDeepseekStatus: document.getElementById('api-deepseek-status'),
            apiKissStatus: document.getElementById('api-kiss-status'),
        };

        const renderEngineBadge = (engine) => {
            const labels = {
                deepseek: 'DeepSeek',
                google: 'Google',
                kiss: 'KISS API',
                microsoft: 'Microsoft',
                mixed: 'Mixed Fallback',
            };
            const kind = engine === 'deepseek' ? 'deepseek' : engine === 'google' ? 'google' : engine === 'kiss' ? 'kiss' : engine === 'microsoft' ? 'microsoft' : 'mixed';
            return '<span class="translate-engine-badge" data-engine="' + kind + '">' + labels[engine] + '</span>';
        };

        const renderStrategyBadge = (strategy, ttl) => {
            const labels = { realtime: 'Realtime', cached: 'Cached ' + ttl + 'm', scheduled: 'Scheduled' };
            return '<span class="translate-strategy-badge" data-strategy="' + strategy + '">' + (labels[strategy] || strategy) + '</span>';
        };

        const renderEngineIndicator = (engine) => {
            if (!elements.previewEngine) {
                return;
            }

            const fallbackChain = ['Microsoft', 'KISS API', 'Google', 'DeepSeek'].join(' → ');
            elements.previewEngine.innerHTML =
                '<span class="translate-engine-label">Translation Engine</span>' +
                renderEngineBadge(engine || state.preferredEngine) +
                '<span class="translate-engine-chain">Fallback: ' + fallbackChain + '</span>';
        };

        const showStatus = (message, kind = 'info') => {
            if (!elements.status) {
                return;
            }

            elements.status.textContent = message;
            elements.status.dataset.kind = kind;
            elements.status.hidden = false;
        };

        const clearStatus = () => {
            if (!elements.status) {
                return;
            }

            elements.status.textContent = '';
            elements.status.hidden = true;
            delete elements.status.dataset.kind;
        };

        const updateApiStatusIndicators = () => {
            if (state.apiConfig) {
                if (elements.apiDeepseekStatus) {
                    elements.apiDeepseekStatus.innerHTML = state.apiConfig.deepseekApiKeySet
                        ? '<span class="api-status-dot is-set"></span> DeepSeek: Configured'
                        : '<span class="api-status-dot"></span> DeepSeek: Not configured';
                }
                if (elements.apiKissStatus) {
                    elements.apiKissStatus.innerHTML = state.apiConfig.kissTranslateUrlSet
                        ? '<span class="api-status-dot is-set"></span> KISS API: Configured'
                        : '<span class="api-status-dot"></span> KISS API: Not configured';
                }
            }
        };

        const loadApiConfig = async () => {
            try {
                const response = await fetch('/translate/api/config');
                const config = await response.json();
                state.apiConfig = config;
                if (elements.deepseekBaseUrl) elements.deepseekBaseUrl.value = config.deepseekBaseUrl || '';
                if (elements.kissTranslateUrl) elements.kissTranslateUrl.value = config.kissTranslateUrl || '';
                if (elements.deepseekApiKey) {
                    elements.deepseekApiKey.placeholder = config.deepseekApiKeySet ? '•••••••• (saved)' : 'sk-...';
                    elements.deepseekApiKey.value = '';
                }
                updateApiStatusIndicators();
            } catch (error) {
                // Silently fail — API config is optional
            }
        };

        const saveApiConfigHandler = async () => {
            if (!elements.apiConfigStatus) return;
            const status = elements.apiConfigStatus;

            status.hidden = false;
            status.textContent = 'Saving API config...';
            status.dataset.kind = 'info';
            elements.saveApiConfig.disabled = true;

            try {
                const body = {
                    deepseekApiKey: elements.deepseekApiKey?.value || undefined,
                    deepseekBaseUrl: elements.deepseekBaseUrl?.value || undefined,
                    kissTranslateUrl: elements.kissTranslateUrl?.value || undefined,
                };

                const response = await fetch('/translate/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Save failed.');

                status.textContent = 'API config saved.';
                status.dataset.kind = 'success';
                await loadApiConfig();
            } catch (error) {
                status.textContent = error instanceof Error ? error.message : 'Save failed.';
                status.dataset.kind = 'error';
            } finally {
                elements.saveApiConfig.disabled = false;
            }
        };

        const escapeHtml = (value) =>
            value
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#39;');

        const renderPreview = () => {
            if (!state.preview || !elements.previewPanel || !elements.previewMeta || !elements.previewItems || !elements.saveButton) {
                return;
            }

            renderEngineIndicator(state.preview.engine);
            elements.previewMeta.innerHTML = '<strong>' + escapeHtml(state.preview.title || 'Untitled Feed') + '</strong>' + ' · ' + String(state.preview.itemCount) + ' items';
            elements.previewItems.innerHTML = state.preview.items
                .map(
                    (item, index) => \`
                        <article class="translate-preview-card">
                            <div class="translate-preview-index">#\${index + 1}</div>
                            <div class="translate-preview-grid">
                                <section>
                                    <h3>Original</h3>
                                    <p class="translate-preview-title">\${escapeHtml(item.originalTitle || '(no title)')}</p>
                                    <p>\${escapeHtml(item.originalDesc || '(no description)')}</p>
                                </section>
                                <section>
                                    <h3>Translated</h3>
                                    <p class="translate-preview-title">\${escapeHtml(item.translatedTitle || '(no translation)')}</p>
                                    <p>\${escapeHtml(item.translatedDesc || '(no translation)')}</p>
                                </section>
                            </div>
                        </article>
                    \`
                )
                .join('');
            elements.previewPanel.hidden = false;
            elements.saveButton.hidden = false;
        };

        const ensurePreviewItem = (index) => {
            if (!state.preview) {
                return null;
            }

            if (!state.preview.items[index]) {
                state.preview.items[index] = {
                    originalDesc: '',
                    originalTitle: '',
                    translatedDesc: '',
                    translatedTitle: '',
                };
            }

            return state.preview.items[index];
        };

        const feedUrlFor = (id) => state.baseUrl + '/translate/feed/' + id;

        const formatTimestamp = (value) => {
            if (!value) {
                return 'Not available';
            }

            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) {
                return value.split('T').join(' ').replace('Z', '');
            }

            return parsed.toLocaleString();
        };

        const renderDetailField = (label, value, modifier = '') =>
            '<div class="translate-detail-item' + (modifier ? ' ' + modifier : '') + '">' +
            '<span class="translate-detail-label">' + escapeHtml(label) + '</span>' +
            '<div class="translate-detail-value">' + value + '</div>' +
            '</div>';

        const currentEngine = () => {
            if (!(elements.engine instanceof HTMLSelectElement)) {
                return state.preferredEngine;
            }

            return elements.engine.value || state.preferredEngine;
        };

        const setEditingFeed = (feed) => {
            state.editingFeedId = feed?.id || '';
            state.editingFeedEnabled = feed?.enabled ?? true;

            if (elements.feedName instanceof HTMLInputElement) {
                elements.feedName.value = feed?.name || '';
            }

            if (elements.feedUrl instanceof HTMLInputElement) {
                elements.feedUrl.value = feed?.url || '';
            }

            if (elements.sourceLang instanceof HTMLSelectElement) {
                elements.sourceLang.value = feed?.sourceLang || 'auto';
            }

            if (elements.targetLang instanceof HTMLSelectElement) {
                elements.targetLang.value = feed?.targetLang || 'en';
            }

            if (elements.engine instanceof HTMLSelectElement) {
                elements.engine.value = feed?.engine || 'deepseek';
            }

            if (elements.paragraphMode instanceof HTMLInputElement) {
                elements.paragraphMode.checked = feed?.paragraphMode ?? false;
            }

            if (elements.translationStrategy instanceof HTMLSelectElement) {
                elements.translationStrategy.value = feed?.translationStrategy || 'realtime';
            }

            const showTtl = (feed?.translationStrategy || 'realtime') === 'cached';
            if (elements.cacheTtl instanceof HTMLInputElement) {
                elements.cacheTtl.value = String(feed?.cacheTtlMinutes ?? 30);
            }
            if (elements.cacheTtlWrapper) {
                elements.cacheTtlWrapper.hidden = !showTtl;
            }

            if (elements.saveButton instanceof HTMLButtonElement) {
                elements.saveButton.textContent = feed ? 'Update & Generate Feed' : 'Save & Generate Feed';
            }

            renderEngineIndicator(feed?.engine || currentEngine());
        };

        const renderSavedFeeds = () => {
            if (!elements.savedList || !elements.savedEmpty) {
                return;
            }

            if (!state.savedFeeds.length) {
                elements.savedList.innerHTML = '';
                elements.savedEmpty.hidden = false;
                return;
            }

            elements.savedEmpty.hidden = true;
            elements.savedList.innerHTML = state.savedFeeds
                .map(
                    (feed) => \`
                        <tr class="translate-saved-row" data-feed-row="true" data-id="\${feed.id}">
                            <td>
                                <div class="translate-feed-name-cell">
                                    <span aria-hidden="true" class="translate-row-arrow">\${state.openFeedId === feed.id ? '▾' : '▸'}</span>
                                    <div class="translate-feed-name-copy">
                                        <strong>\${escapeHtml(feed.name)}</strong>
                                        <span class="translate-feed-meta">Updated \${escapeHtml(formatTimestamp(feed.updatedAt))}</span>
                                    </div>
                                </div>
                            </td>
                            <td class="translate-table-url">\${escapeHtml(feed.url)}</td>
                            <td>\${escapeHtml(feed.sourceLang + ' → ' + feed.targetLang)}</td>
                            <td>
                                <label class="translate-toggle">
                                    <input data-action="toggle" data-id="\${feed.id}" type="checkbox" \${feed.enabled ? 'checked' : ''} />
                                    <span>\${feed.enabled ? 'ON' : 'OFF'}</span>
                                </label>
                            </td>
                            <td>\${renderEngineBadge(feed.engine || 'deepseek')}</td>
                            <td>
                                <div class="translate-strategy-cell">
                                    \${renderStrategyBadge(feed.translationStrategy || 'realtime', feed.cacheTtlMinutes ?? 30)}
                                </div>
                            </td>
                            <td>
                                <a href="/translate/feed/\${feed.id}" target="_blank">\${escapeHtml('/translate/feed/' + feed.id)}</a>
                            </td>
                            <td class="translate-row-actions">
                                <button data-action="toggle-detail" data-id="\${feed.id}" type="button">\${state.openFeedId === feed.id ? 'Hide' : 'View'}</button>
                                <button data-action="edit" data-id="\${feed.id}" type="button">Edit</button>
                                \${(feed.translationStrategy || 'realtime') === 'scheduled' ? '<button data-action="refresh" data-id="' + feed.id + '" type="button">Refresh</button>' : ''}
                                <button data-action="copy" data-id="\${feed.id}" type="button">Copy URL</button>
                                <button data-action="delete" data-id="\${feed.id}" type="button">Delete</button>
                            </td>
                        </tr>
                        <tr class="translate-detail-row \${state.openFeedId === feed.id ? 'is-open' : ''}" data-detail-row="true" data-feed-id="\${feed.id}">
                            <td colspan="8">
                                <div class="translate-detail-panel">
                                    <div class="translate-detail-grid">
                                        \${renderDetailField('ID', escapeHtml(feed.id))}
                                        \${renderDetailField('Feed Name', escapeHtml(feed.name))}
                                        \${renderDetailField('Source URL', '<a href="' + escapeHtml(feed.url) + '" target="_blank">' + escapeHtml(feed.url) + '</a>', 'is-wide')}
                                        \${renderDetailField('Source Language', escapeHtml(feed.sourceLang))}
                                        \${renderDetailField('Target Language', escapeHtml(feed.targetLang))}
                                        \${renderDetailField('Engine', renderEngineBadge(feed.engine || 'deepseek'))}
                                        \${renderDetailField('Strategy', renderStrategyBadge(feed.translationStrategy || 'realtime', feed.cacheTtlMinutes ?? 30))}
                                        \${renderDetailField('Paragraph Mode', escapeHtml(feed.paragraphMode ? 'Enabled' : 'Disabled'))}
                                        \${renderDetailField('Enabled', escapeHtml(feed.enabled ? 'Yes' : 'No'))}
                                        \${renderDetailField('Generated Feed', '<a href="' + escapeHtml(feedUrlFor(feed.id)) + '" target="_blank">' + escapeHtml(feedUrlFor(feed.id)) + '</a>', 'is-wide')}
                                        \${renderDetailField('Created At', escapeHtml(formatTimestamp(feed.createdAt)))}
                                        \${renderDetailField('Updated At', escapeHtml(formatTimestamp(feed.updatedAt)))}
                                    </div>
                                </div>
                            </td>
                        </tr>
                    \`
                )
                .join('');
        };

        const toggleFeedDetail = (id) => {
            state.openFeedId = state.openFeedId === id ? '' : id;
            renderSavedFeeds();
        };

        const loadSavedFeeds = async () => {
            const response = await fetch('/translate/api/feeds');
            const feeds = await response.json();
            if (!response.ok) {
                throw new Error(feeds.error || 'Unable to load saved translations.');
            }

            state.savedFeeds = feeds;
            if (state.openFeedId && !state.savedFeeds.some((feed) => feed.id === state.openFeedId)) {
                state.openFeedId = '';
            }
            if (state.editingFeedId) {
                const editingFeed = state.savedFeeds.find((feed) => feed.id === state.editingFeedId);
                if (editingFeed) {
                    state.editingFeedEnabled = editingFeed.enabled;
                }
            }
            renderSavedFeeds();
        };

        const currentFormPayload = () => ({
            id: state.editingFeedId || undefined,
            name: elements.feedName?.value.trim() || '',
            url: elements.feedUrl?.value.trim() || '',
            sourceLang: elements.sourceLang?.value || 'auto',
            targetLang: elements.targetLang?.value || 'en',
            engine: currentEngine(),
            paragraphMode: elements.paragraphMode instanceof HTMLInputElement ? elements.paragraphMode.checked : false,
            translationStrategy: elements.translationStrategy instanceof HTMLSelectElement ? elements.translationStrategy.value : 'realtime',
            cacheTtlMinutes: elements.cacheTtl instanceof HTMLInputElement ? parseInt(elements.cacheTtl.value, 10) || 30 : 30,
            enabled: state.editingFeedEnabled,
        });

        elements.previewButton?.addEventListener('click', async () => {
            clearStatus();
            showStatus('Fetching feed and streaming preview translations...');
            elements.previewButton.disabled = true;

            try {
                const payload = currentFormPayload();
                const requestedEngine = payload.engine;
                state.preview = {
                    engine: requestedEngine,
                    itemCount: 0,
                    items: [],
                    title: '',
                };
                renderPreview();
                renderEngineIndicator(requestedEngine);

                const response = await fetch('/translate/api/preview?stream=1', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!response.ok) {
                    const result = await response.json();
                    throw new Error(result.error || 'Preview failed.');
                }
                if (!response.body) {
                    throw new Error('Preview stream is unavailable.');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (!line.trim()) {
                            continue;
                        }

                        const event = JSON.parse(line);
                        if (event.type === 'meta') {
                            state.preview = {
                                engine: requestedEngine,
                                itemCount: event.itemCount,
                                items: [],
                                title: event.title,
                            };
                            renderPreview();
                            continue;
                        }

                        if (event.type === 'item') {
                            const item = ensurePreviewItem(event.index);
                            if (!item) {
                                continue;
                            }

                            Object.assign(item, event.item);
                            state.preview.engine = event.engine;
                            renderPreview();
                            showStatus('Preview streaming... translated ' + String(state.preview.items.filter((entry) => entry.translatedTitle || entry.translatedDesc).length) + ' items.', 'info');
                            continue;
                        }

                        if (event.type === 'done') {
                            state.preview = {
                                engine: event.engine,
                                itemCount: event.itemCount,
                                items: event.items,
                                title: event.title,
                            };
                            renderPreview();
                            showStatus('Preview ready. Review the first 3 translated items below.', 'success');
                            continue;
                        }

                        if (event.type === 'error') {
                            throw new Error(event.error || 'Preview failed.');
                        }
                    }
                }
            } catch (error) {
                showStatus(error instanceof Error ? error.message : 'Preview failed.', 'error');
            } finally {
                elements.previewButton.disabled = false;
            }
        });

        elements.saveButton?.addEventListener('click', async () => {
            clearStatus();
            showStatus('Saving translation config...');
            elements.saveButton.disabled = true;

            try {
                const wasEditing = Boolean(state.editingFeedId);
                const response = await fetch('/translate/api/feeds', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(currentFormPayload()),
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || 'Save failed.');
                }

                await loadSavedFeeds();
                setEditingFeed(result);
                showStatus((wasEditing ? 'Updated' : 'Saved') + '. Generated feed URL: ' + feedUrlFor(result.id), 'success');
            } catch (error) {
                showStatus(error instanceof Error ? error.message : 'Save failed.', 'error');
            } finally {
                elements.saveButton.disabled = false;
            }
        });

        elements.savedList?.addEventListener('click', async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }

            const actionTarget = target.closest('[data-action]');
            if (actionTarget instanceof HTMLElement) {
                const action = actionTarget.dataset.action;
                const id = actionTarget.dataset.id;
                if (!action || !id) {
                    return;
                }

                if (action === 'toggle-detail') {
                    toggleFeedDetail(id);
                    return;
                }

                if (action === 'refresh') {
                    showStatus('Refreshing translation cache...');
                    const response = await fetch('/translate/api/refresh/' + id, { method: 'POST' });
                    if (!response.ok) {
                        const text = await response.text();
                        showStatus(text || 'Refresh failed.', 'error');
                        return;
                    }
                    showStatus('Translation cache refreshed.', 'success');
                    return;
                }

                if (action === 'copy') {
                    await navigator.clipboard.writeText(feedUrlFor(id));
                    showStatus('Feed URL copied to clipboard.', 'success');
                    return;
                }

                if (action === 'edit') {
                    const feed = state.savedFeeds.find((entry) => entry.id === id);
                    if (!feed) {
                        showStatus('Saved translation config not found.', 'error');
                        return;
                    }

                    setEditingFeed(feed);
                    showStatus('Loaded saved translation config into the form.', 'success');
                    return;
                }

                if (action === 'delete') {
                    showStatus('Deleting translation config...');
                    const response = await fetch('/translate/api/feeds/' + id, { method: 'DELETE' });
                    const result = await response.json();
                    if (!response.ok) {
                        showStatus(result.error || 'Delete failed.', 'error');
                        return;
                    }

                    if (state.openFeedId === id) {
                        state.openFeedId = '';
                    }
                    await loadSavedFeeds();
                    if (state.editingFeedId === id) {
                        setEditingFeed(null);
                    }
                    showStatus('Translation config deleted.', 'success');
                }
                return;
            }

            if (target.closest('a, input, label, button')) {
                return;
            }

            const row = target.closest('[data-feed-row="true"]');
            if (row instanceof HTMLElement && row.dataset.id) {
                toggleFeedDetail(row.dataset.id);
            }
        });

        elements.savedList?.addEventListener('change', async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement) || target.dataset.action !== 'toggle' || !target.dataset.id) {
                return;
            }

            const feed = state.savedFeeds.find((entry) => entry.id === target.dataset.id);
            if (!feed) {
                return;
            }

            showStatus('Updating feed status...');
            const response = await fetch('/translate/api/feeds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: feed.id, enabled: target.checked }),
            });
            const result = await response.json();
            if (!response.ok) {
                target.checked = !target.checked;
                showStatus(result.error || 'Unable to update status.', 'error');
                return;
            }

            await loadSavedFeeds();
            showStatus('Feed status updated.', 'success');
        });

        elements.form?.addEventListener('submit', (event) => {
            event.preventDefault();
        });

        elements.engine?.addEventListener('change', () => {
            renderEngineIndicator(currentEngine());
        });

        elements.translationStrategy?.addEventListener('change', () => {
            const showTtl = elements.translationStrategy instanceof HTMLSelectElement && elements.translationStrategy.value === 'cached';
            if (elements.cacheTtlWrapper) {
                elements.cacheTtlWrapper.hidden = !showTtl;
            }
        });

        // Toggle API config panel
        elements.toggleApiConfig?.addEventListener('click', () => {
            state.apiConfigPanelOpen = !state.apiConfigPanelOpen;
            elements.apiConfigPanel.hidden = !state.apiConfigPanelOpen;
            elements.toggleApiConfig.textContent = state.apiConfigPanelOpen ? 'Hide' : 'Show';
        });

        // Save config button
        elements.saveApiConfig?.addEventListener('click', saveApiConfigHandler);

        setEditingFeed(null);
        loadSavedFeeds().catch((error) => {
            showStatus(error instanceof Error ? error.message : 'Unable to load saved translations.', 'error');
        });
        loadApiConfig();
    })();
`;

const TranslateView: FC<{ baseUrl: string }> = ({ baseUrl }) => {
    const bootScript = `window.__TRANSLATE_CONSOLE__ = ${JSON.stringify({ baseUrl, preferredEngine: getPreferredTranslationEngine(), translationEngines }).replaceAll('<', String.raw`\u003c`)};`;

    return (
        <Layout title="RSSHub Translate Console">
            <div className="translate-console" data-theme="jis">
                <style>{jisThemeCss}</style>
                <style>{`
                    :root {
                        --radius: 0.5rem;
                        --radius-lg: 0.75rem;
                        --radius-xl: 1rem;
                    }

                    .translate-console {
                        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                    }

                    .translate-hero h1,
                    .translate-panel h2,
                    .translate-preview-card h3 {
                        margin: 0;
                    }

                    .translate-field span,
                    .translate-panel label span {
                        color: color-mix(in srgb, var(--jis-fg) 52%, var(--jis-blue) 48%);
                        font-size: 0.85rem;
                    }

                    .translate-console input,
                    .translate-console select,
                    .translate-console textarea,
                    .translate-console button {
                        font: inherit;
                        transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
                    }

                    .translate-status {
                        border: 1px solid color-mix(in srgb, var(--jis-blue) 20%, transparent);
                        background: color-mix(in srgb, var(--muted) 80%, var(--card));
                        color: color-mix(in srgb, var(--jis-fg) 74%, var(--jis-blue) 26%);
                    }

                    .translate-status[data-kind='success'] {
                        border-color: color-mix(in srgb, var(--jis-green) 28%, transparent);
                        color: color-mix(in srgb, var(--jis-fg) 68%, var(--jis-green) 32%);
                    }

                    .translate-status[data-kind='error'] {
                        border-color: color-mix(in srgb, var(--jis-red) 28%, transparent);
                        color: color-mix(in srgb, var(--jis-fg) 62%, var(--jis-red) 38%);
                    }

                    .translate-preview-meta {
                        color: color-mix(in srgb, var(--jis-fg) 78%, var(--jis-blue) 22%);
                    }

                    .translate-engine-indicator {
                        display: flex;
                        align-items: center;
                        gap: 0.75rem;
                        flex-wrap: wrap;
                        margin-bottom: 1rem;
                        color: color-mix(in srgb, var(--jis-fg) 70%, var(--jis-blue) 30%);
                    }

                    .translate-engine-label,
                    .translate-engine-chain {
                        font-size: 0.85rem;
                    }

                    .translate-engine-badge {
                        display: inline-flex;
                        align-items: center;
                        min-height: 28px;
                        border-radius: 999px;
                        padding: 0 0.75rem;
                        font-size: 0.85rem;
                        font-weight: 700;
                        letter-spacing: 0.02em;
                        border: 1px solid color-mix(in srgb, var(--jis-fg) 10%, transparent);
                    }

                    .translate-engine-badge[data-engine='deepseek'] {
                        background: color-mix(in srgb, var(--jis-green) 24%, transparent);
                        color: color-mix(in srgb, white 82%, var(--jis-green) 18%);
                        border-color: color-mix(in srgb, var(--jis-green) 32%, transparent);
                    }

                    .translate-engine-badge[data-engine='kiss'] {
                        background: color-mix(in srgb, var(--jis-blue) 20%, transparent);
                        color: color-mix(in srgb, white 82%, var(--jis-blue) 18%);
                        border-color: color-mix(in srgb, var(--jis-blue) 30%, transparent);
                    }

                    .translate-engine-badge[data-engine='google'] {
                        background: color-mix(in srgb, var(--jis-yellow) 18%, transparent);
                        color: color-mix(in srgb, white 84%, var(--jis-yellow) 16%);
                        border-color: color-mix(in srgb, var(--jis-yellow) 28%, transparent);
                    }

                    .translate-engine-badge[data-engine='mixed'] {
                        background: color-mix(in srgb, var(--jis-orange) 18%, transparent);
                        color: color-mix(in srgb, white 82%, var(--jis-orange) 18%);
                        border-color: color-mix(in srgb, var(--jis-orange) 28%, transparent);
                    }

                    .translate-engine-badge[data-engine='microsoft'] {
                        background: color-mix(in srgb, var(--jis-accent) 18%, transparent);
                        color: color-mix(in srgb, white 84%, var(--jis-accent) 16%);
                        border-color: color-mix(in srgb, var(--jis-accent) 28%, transparent);
                    }

                    .translate-strategy-badge {
                        display: inline-flex;
                        align-items: center;
                        min-height: 24px;
                        border-radius: 999px;
                        padding: 0 0.65rem;
                        font-size: 0.8rem;
                        font-weight: 600;
                        letter-spacing: 0.02em;
                        border: 1px solid color-mix(in srgb, var(--jis-fg) 8%, transparent);
                        white-space: nowrap;
                    }

                    .translate-strategy-badge[data-strategy='realtime'] {
                        background: color-mix(in srgb, var(--jis-green) 16%, transparent);
                        color: color-mix(in srgb, white 84%, var(--jis-green) 16%);
                        border-color: color-mix(in srgb, var(--jis-green) 24%, transparent);
                    }

                    .translate-strategy-badge[data-strategy='cached'] {
                        background: color-mix(in srgb, var(--jis-blue) 16%, transparent);
                        color: color-mix(in srgb, white 84%, var(--jis-blue) 16%);
                        border-color: color-mix(in srgb, var(--jis-blue) 24%, transparent);
                    }

                    .translate-strategy-badge[data-strategy='scheduled'] {
                        background: color-mix(in srgb, var(--jis-orange) 16%, transparent);
                        color: color-mix(in srgb, white 84%, var(--jis-orange) 16%);
                        border-color: color-mix(in srgb, var(--jis-orange) 24%, transparent);
                    }

                    .translate-preview-list {
                        display: grid;
                        gap: 0.9rem;
                    }

                    .translate-preview-card {
                        border: 1px solid color-mix(in srgb, var(--jis-fg) 8%, transparent);
                        border-radius: var(--radius-lg);
                        padding: 1rem;
                        background: color-mix(in srgb, var(--card) 92%, var(--muted));
                        max-width: 100%;
                        overflow: hidden;
                    }

                    .translate-preview-index {
                        color: var(--jis-orange);
                        margin-bottom: 0.75rem;
                    }

                    .translate-preview-grid {
                        display: grid;
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 1rem;
                    }

                    .translate-preview-card h3 {
                        color: color-mix(in srgb, var(--jis-fg) 52%, var(--jis-blue) 48%);
                        font-size: 0.85rem;
                        margin-bottom: 0.5rem;
                    }

                    .translate-preview-card p {
                        margin: 0;
                        line-height: 1.6;
                        white-space: pre-wrap;
                        word-break: break-word;
                    }

                    .translate-preview-title {
                        color: var(--jis-yellow);
                        margin-bottom: 0.6rem !important;
                    }

                    .translate-saved-table th,
                    .translate-saved-table td {
                        padding: 0.85rem 0.7rem;
                        border-bottom: 1px solid color-mix(in srgb, var(--jis-fg) 8%, transparent);
                        text-align: left;
                        vertical-align: top;
                    }

                    .translate-saved-row {
                        cursor: pointer;
                    }

                    .translate-saved-row:hover {
                        background: color-mix(in srgb, var(--jis-blue) 4%, var(--card));
                    }

                    .translate-feed-name-cell {
                        display: flex;
                        align-items: flex-start;
                        gap: 0.75rem;
                    }

                    .translate-feed-name-copy {
                        display: grid;
                        gap: 0.25rem;
                    }

                    .translate-feed-meta {
                        color: var(--muted-foreground);
                        font-size: 0.8rem;
                    }

                    .translate-row-arrow {
                        color: var(--jis-blue);
                        font-size: 0.95rem;
                        line-height: 1.5;
                        transition: transform 0.2s ease, color 0.2s ease;
                    }

                    .translate-detail-row td {
                        padding: 0;
                        border-bottom: 0;
                    }

                    .translate-detail-panel {
                        margin: 0 0.7rem 0.9rem;
                        padding: 0;
                        border-radius: var(--radius-lg);
                        border: 1px solid color-mix(in srgb, var(--jis-blue) 14%, var(--border));
                        background: color-mix(in srgb, var(--muted) 88%, var(--card));
                        overflow: hidden;
                        max-height: 0;
                        opacity: 0;
                        transform: translateY(-6px);
                        transition: max-height 0.24s ease, opacity 0.2s ease, transform 0.24s ease, padding 0.24s ease;
                    }

                    .translate-detail-row.is-open .translate-detail-panel {
                        max-height: 900px;
                        opacity: 1;
                        transform: translateY(0);
                        padding: 1rem;
                    }

                    .translate-detail-grid {
                        display: grid;
                        gap: 0.75rem;
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }

                    .translate-detail-item {
                        display: grid;
                        gap: 0.35rem;
                        min-width: 0;
                    }

                    .translate-detail-item.is-wide {
                        grid-column: 1 / -1;
                    }

                    .translate-detail-label {
                        color: color-mix(in srgb, var(--jis-fg) 54%, var(--jis-blue) 46%);
                        font-size: 0.78rem;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                    }

                    .translate-detail-value {
                        color: var(--jis-fg);
                        line-height: 1.6;
                        word-break: break-word;
                    }

                    .translate-detail-value a {
                        color: var(--jis-blue);
                        text-decoration: none;
                        word-break: break-all;
                    }

                    .translate-detail-value a:hover {
                        text-decoration: underline;
                    }

                    .translate-saved-table a {
                        color: color-mix(in srgb, var(--jis-fg) 44%, var(--jis-blue) 56%);
                        word-break: break-all;
                    }

                    .translate-table-scroll {
                        overflow-x: auto;
                    }

                    .translate-saved-table {
                        min-width: 100%;
                    }

                    .translate-table-url {
                        word-break: break-all;
                    }

                    .translate-row-actions {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 0.5rem;
                    }

                    .translate-row-actions button {
                        min-height: 44px;
                        border-radius: 0.375rem;
                        background: color-mix(in srgb, var(--card) 78%, var(--muted));
                        color: var(--jis-fg);
                        border: 1px solid color-mix(in srgb, var(--jis-fg) 10%, var(--border));
                        cursor: pointer;
                        padding: 0 0.75rem;
                    }

                    .translate-row-actions button:hover {
                        background: color-mix(in srgb, var(--jis-blue) 8%, var(--card));
                    }

                    .translate-toggle {
                        display: inline-flex;
                        align-items: center;
                        gap: 0.5rem;
                    }

                    .translate-toggle input {
                        width: 18px;
                        height: 18px;
                    }

                    .translate-help {
                        color: color-mix(in srgb, var(--jis-fg) 74%, var(--jis-blue) 26%);
                        line-height: 1.7;
                    }

                    .translate-help code {
                        color: var(--jis-yellow);
                    }

                    @media (max-width: 768px) {
                        .translate-preview-grid {
                            grid-template-columns: 1fr;
                        }

                        .translate-saved-table,
                        .translate-saved-table tbody,
                        .translate-saved-table tr,
                        .translate-saved-table td {
                            display: block;
                            width: 100%;
                        }

                        .translate-saved-table thead {
                            display: none;
                        }

                        .translate-saved-table tr {
                            padding: 0.75rem 0;
                            border-bottom: 1px solid color-mix(in srgb, var(--jis-fg) 8%, transparent);
                        }

                        .translate-saved-table td {
                            padding: 0.35rem 0.75rem;
                            border: 0;
                        }

                        .translate-detail-panel {
                            margin: 0 0.75rem 0.9rem;
                        }

                        .translate-detail-grid {
                            grid-template-columns: 1fr;
                        }

                        .translate-detail-item.is-wide {
                            grid-column: auto;
                        }
                    }

                    @media (max-width: 480px) {
                        .translate-row-actions {
                            flex-direction: column;
                        }

                        .translate-row-actions button {
                            width: 100%;
                        }
                    }

                    .api-status-dot {
                        display: inline-block;
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        background: color-mix(in srgb, var(--muted-foreground) 70%, transparent);
                        margin-right: 0.4rem;
                    }
                    .api-status-dot.is-set {
                        background: var(--jis-green);
                    }
                `}</style>
                <div className="min-h-screen bg-[linear-gradient(180deg,color-mix(in_srgb,var(--jis-blue)_8%,var(--jis-bg))_0%,var(--jis-bg)_20%)] pb-[env(safe-area-inset-bottom,16px)] text-[var(--jis-fg)]">
                    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6 md:gap-6 md:px-8 md:py-8">
                        <header className="translate-hero max-w-full overflow-hidden rounded-[var(--radius-xl)] border border-[color-mix(in_srgb,var(--jis-accent)_30%,transparent)] bg-[var(--card)]/95 shadow-[0_20px_60px_color-mix(in_srgb,var(--jis-bg)_72%,transparent)]">
                            <div className="flex flex-col items-start gap-3 px-5 py-6 sm:px-6 md:flex-row md:items-start md:justify-between md:px-8 md:py-8">
                                <div className="min-w-0 max-w-full break-words">
                                    <h1 className="text-[clamp(1.5rem,1.1rem+1.4vw,2.25rem)] font-bold tracking-tight text-[var(--jis-accent)]">{'> '}RSSHub Translate Console</h1>
                                    <p className="mt-1 break-words whitespace-normal text-sm md:text-base text-[var(--muted-foreground)]">terminal://rsshub/translate</p>
                                </div>
                                <a
                                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-[var(--border)] bg-transparent px-4 py-2 text-sm md:text-base font-medium text-[var(--jis-blue)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jis-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] sm:w-auto"
                                    href="/"
                                >
                                    ← Back to Home
                                </a>
                            </div>
                        </header>

                        <main className="grid gap-5 md:gap-6">
                            <section className="translate-panel max-w-full overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5 md:p-6">
                                <h2 className="mb-4 text-base md:text-xl font-semibold text-[var(--jis-accent)]">New Translation</h2>
                                <form className="space-y-4" id="translate-form">
                                    <div className="translate-engine-indicator" id="preview-engine"></div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <label className="translate-field grid gap-2">
                                            <span>Feed Name</span>
                                            <input
                                                className="flex min-h-[44px] w-full max-w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm md:text-base text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jis-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                                                id="feed-name"
                                                name="name"
                                                placeholder="My translated feed"
                                            />
                                        </label>
                                        <label className="translate-field grid gap-2">
                                            <span>Feed URL</span>
                                            <input
                                                className="flex min-h-[44px] w-full max-w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm md:text-base text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jis-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                                                id="feed-url"
                                                name="url"
                                                placeholder="https://example.com/rss.xml"
                                            />
                                        </label>
                                        <label className="translate-field grid gap-2">
                                            <span>Source Language</span>
                                            <select
                                                className="flex min-h-[44px] w-full max-w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm md:text-base text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jis-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                                                id="source-lang"
                                                name="sourceLang"
                                            >
                                                {languageOptions.map((option) => (
                                                    <option selected={option.value === 'auto'} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="translate-field grid gap-2">
                                            <span>Target Language</span>
                                            <select
                                                className="flex min-h-[44px] w-full max-w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm md:text-base text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jis-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                                                id="target-lang"
                                                name="targetLang"
                                            >
                                                {languageOptions
                                                    .filter((option) => option.value !== 'auto')
                                                    .map((option) => (
                                                        <option selected={option.value === 'en'} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                            </select>
                                        </label>
                                        <label className="translate-field grid gap-2">
                                            <span>Translation Engine</span>
                                            <select
                                                className="flex min-h-[44px] w-full max-w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm md:text-base text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jis-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                                                id="translation-engine"
                                                name="engine"
                                            >
                                                {translationEngines.map((option) => (
                                                    <option selected={option.value === 'deepseek'} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="translate-field flex min-h-[44px] items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm md:text-base text-[var(--foreground)]">
                                            <input className="h-4 w-4" id="paragraph-mode" name="paragraphMode" type="checkbox" />
                                            <span>Paragraph-level translation</span>
                                        </label>
                                        <label className="translate-field grid gap-2">
                                            <span>Translation Strategy</span>
                                            <select
                                                className="flex min-h-[44px] w-full max-w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm md:text-base text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jis-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                                                id="translation-strategy"
                                                name="translationStrategy"
                                            >
                                                <option selected value="realtime">
                                                    Realtime (live translate every request)
                                                </option>
                                                <option value="cached">Cached (cache for N minutes)</option>
                                                <option value="scheduled">Scheduled (pre-translate, cache only)</option>
                                            </select>
                                        </label>
                                        <label className="translate-field grid gap-2" id="cache-ttl-wrapper" hidden>
                                            <span>Cache TTL (minutes)</span>
                                            <input
                                                className="flex min-h-[44px] w-full max-w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm md:text-base text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jis-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                                                id="cache-ttl"
                                                min="1"
                                                name="cacheTtl"
                                                type="number"
                                                value="30"
                                            />
                                        </label>
                                    </div>
                                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
                                        <button
                                            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-[var(--jis-accent)] px-4 py-2 text-sm md:text-base font-medium text-[var(--primary-foreground)] transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jis-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
                                            id="preview-button"
                                            type="button"
                                        >
                                            Translate & Preview
                                        </button>
                                        <button
                                            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-[var(--border)] bg-transparent px-4 py-2 text-sm md:text-base font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jis-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
                                            hidden
                                            id="save-button"
                                            type="button"
                                        >
                                            Save & Generate Feed
                                        </button>
                                    </div>
                                    <div className="translate-status break-words whitespace-normal rounded-[var(--radius-lg)] px-4 py-3 text-sm md:text-base" hidden id="translate-status"></div>
                                </form>

                                <div className="translate-panel mt-5 max-w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--muted)] p-4 shadow-sm sm:p-5" hidden id="preview-panel">
                                    <h2 className="mb-3 text-base md:text-xl font-semibold text-[var(--jis-yellow)]">Preview</h2>
                                    <p className="translate-preview-meta mb-4 break-words whitespace-normal text-sm md:text-base" id="preview-meta"></p>
                                    <div className="translate-preview-list" id="preview-items"></div>
                                </div>
                            </section>

                            <section className="translate-panel max-w-full overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5 md:p-6">
                                <h2 className="text-base md:text-xl font-semibold text-[var(--jis-blue)]">
                                    API Configuration
                                    <button
                                        className="ml-3 inline-flex min-h-[36px] items-center justify-center rounded-md border border-[var(--border)] bg-transparent px-3 py-1 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jis-blue)]"
                                        id="toggle-api-config"
                                        type="button"
                                    >
                                        Show
                                    </button>
                                </h2>
                                <div className="mt-4 max-w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--muted)] p-4 shadow-sm sm:p-5" hidden id="api-config-panel">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <label className="translate-field grid gap-2">
                                            <span>DeepSeek API Key</span>
                                            <input
                                                autocomplete="off"
                                                className="flex min-h-[44px] w-full max-w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm md:text-base text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jis-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                                                id="deepseek-api-key"
                                                placeholder="sk-..."
                                                type="password"
                                            />
                                        </label>
                                        <label className="translate-field grid gap-2">
                                            <span>DeepSeek Base URL</span>
                                            <input
                                                className="flex min-h-[44px] w-full max-w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm md:text-base text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jis-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                                                id="deepseek-base-url"
                                                placeholder="https://api.deepseek.com/v1/chat/completions"
                                                type="text"
                                            />
                                        </label>
                                    </div>
                                    <label className="translate-field mt-4 grid gap-2">
                                        <span>KISS Translate URL</span>
                                        <input
                                            className="flex min-h-[44px] w-full max-w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm md:text-base text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jis-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                                            id="kiss-translate-url"
                                            placeholder="http://..."
                                            type="text"
                                        />
                                    </label>
                                    <div className="mt-4 space-y-2 text-sm md:text-base">
                                        <div id="api-deepseek-status">
                                            <span className="api-status-dot"></span> DeepSeek: Not configured
                                        </div>
                                        <div id="api-kiss-status">
                                            <span className="api-status-dot"></span> KISS API: Not configured
                                        </div>
                                    </div>
                                    <div className="mt-4 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
                                        <button
                                            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-[var(--jis-accent)] px-4 py-2 text-sm md:text-base font-medium text-[var(--primary-foreground)] transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jis-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
                                            id="save-api-config"
                                            type="button"
                                        >
                                            Save API Config
                                        </button>
                                    </div>
                                    <div className="translate-status mt-4 break-words whitespace-normal rounded-[var(--radius-lg)] px-4 py-3 text-sm md:text-base" hidden id="api-config-status"></div>
                                </div>
                            </section>

                            <section className="translate-panel max-w-full overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5 md:p-6">
                                <h2 className="text-base md:text-xl font-semibold text-[var(--jis-blue)]">Saved Translations</h2>
                                <p className="mt-4 break-words whitespace-normal text-sm md:text-base text-[var(--muted-foreground)]" hidden id="saved-feeds-empty">
                                    No saved translations. Add one above.
                                </p>
                                <div className="translate-table-scroll mt-4 w-full max-w-full overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--muted)]">
                                    <table className="translate-saved-table min-w-full caption-bottom text-sm md:text-base">
                                        <thead className="border-b border-[var(--border)]">
                                            <tr className="hover:bg-transparent">
                                                <th className="h-10 px-3 text-left align-middle font-medium text-[var(--muted-foreground)]">Feed Name</th>
                                                <th className="h-10 px-3 text-left align-middle font-medium text-[var(--muted-foreground)]">Source URL</th>
                                                <th className="h-10 px-3 text-left align-middle font-medium text-[var(--muted-foreground)]">Lang</th>
                                                <th className="h-10 px-3 text-left align-middle font-medium text-[var(--muted-foreground)]">Status</th>
                                                <th className="h-10 px-3 text-left align-middle font-medium text-[var(--muted-foreground)]">Engine</th>
                                                <th className="h-10 px-3 text-left align-middle font-medium text-[var(--muted-foreground)]">Strategy</th>
                                                <th className="h-10 px-3 text-left align-middle font-medium text-[var(--muted-foreground)]">Generated Path</th>
                                                <th className="h-10 px-3 text-left align-middle font-medium text-[var(--muted-foreground)]">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody id="saved-feeds-list"></tbody>
                                    </table>
                                </div>
                            </section>

                            <section className="translate-panel max-w-full overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5 md:p-6">
                                <h2 className="mb-4 text-base md:text-xl font-semibold text-[var(--jis-orange)]">Help / Info</h2>
                                <div className="translate-help space-y-4 text-sm md:text-base">
                                    <p className="m-0 break-words whitespace-normal">This console fetches an existing RSS or Atom feed, translates item titles and descriptions, and exposes the result as a new RSSHub endpoint.</p>
                                    <p className="m-0 break-words whitespace-normal">
                                        Typical flow: paste a feed URL, preview the first three translated items, save the configuration, then subscribe to <code>/translate/feed/&lt;id&gt;</code>.
                                    </p>
                                    <p className="m-0 break-words whitespace-normal">
                                        Example: use source language <code>auto</code>, target language <code>en</code>, then copy the generated URL into your reader after saving.
                                    </p>
                                </div>
                            </section>
                        </main>
                    </div>
                </div>
            </div>

            <script dangerouslySetInnerHTML={{ __html: bootScript }} />
            <script dangerouslySetInnerHTML={{ __html: interactionScript }} />
        </Layout>
    );
};

export default TranslateView;
