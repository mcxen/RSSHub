import type { FC } from 'hono/jsx';

import type { SouthPlusForwardConfigSummary } from '@/local-forward/south-plus/shared';
import { southPlusLocalFeedPath, southPlusManagerPath } from '@/local-forward/south-plus/shared';
import { Layout } from '@/views/layout';

type SouthPlusManagerPageProps = {
    config: SouthPlusForwardConfigSummary;
    currentOrigin: string;
    configPath: string;
    plistPath: string;
    repoPath: string;
};

const SouthPlusManagerPage: FC<SouthPlusManagerPageProps> = ({ config, configPath, currentOrigin, plistPath, repoPath }) => {
    const localFeedUrl = `${currentOrigin}${southPlusLocalFeedPath}`;
    const apiPath = '/api/local-forward/south-plus/config';
    const browserLoginApiPath = '/api/local-forward/south-plus/browser-login';
    const setupCommands = ['pnpm build', 'node scripts/macos/install-launch-agent.mjs', 'launchctl load ~/Library/LaunchAgents/cc.rsshub.south-plus.plist'];
    const bootScript = `
        window.__SOUTH_PLUS_MANAGER__ = ${JSON.stringify({ config, localFeedUrl, southPlusManagerPath, apiPath, browserLoginApiPath }).replaceAll('<', String.raw`\u003c`)};
    `;
    const interactionScript = `
        (() => {
            const state = window.__SOUTH_PLUS_MANAGER__;
            const form = document.getElementById('south-plus-config-form');
            const status = document.getElementById('save-status');
            const feedButton = document.getElementById('copy-feed-url');
            const browserLoginButton = document.getElementById('browser-login');
            const forceBrowserLoginButton = document.getElementById('force-browser-login');
            const cookieInput = document.getElementById('cookie');
            const forumUrlInput = document.getElementById('forum-url');
            const includeKeywordsInput = document.getElementById('include-keywords');
            const excludeKeywordsInput = document.getElementById('exclude-keywords');
            const includeAuthorsInput = document.getElementById('include-authors');
            const excludeAuthorsInput = document.getElementById('exclude-authors');
            const includeCategoriesInput = document.getElementById('include-categories');
            const excludeCategoriesInput = document.getElementById('exclude-categories');

            const showStatus = (message) => {
                if (!status) {
                    return;
                }

                status.textContent = message;
                status.classList.remove('hidden');
            };

            feedButton?.addEventListener('click', async () => {
                await navigator.clipboard.writeText(state.localFeedUrl);
                showStatus('本地 RSS 地址已复制到剪贴板。');
            });

            const doBrowserLogin = async (force) => {
                const btn = force ? forceBrowserLoginButton : browserLoginButton;
                btn?.setAttribute('disabled', 'true');
                btn?.classList.add('cursor-not-allowed', 'opacity-60');
                showStatus(force ? '正在强制重启浏览器...' : '正在启动浏览器...');
                const pendingHintTimer = window.setTimeout(() => {
                    showStatus('请在弹出的浏览器窗口中登录，然后点击页面上的"已登录"按钮');
                }, 1200);

                try {
                    const response = await fetch(state.browserLoginApiPath, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ force: !!force }),
                    });
                    const result = await response.json();

                    if (!response.ok || result.code !== 0) {
                        showStatus(result.message || '启动失败，请稍后重试。');
                        return;
                    }

                    if (result.data?.status === 'success') {
                        if (cookieInput && result.data.cookie) {
                            cookieInput.value = result.data.cookie;
                        }
                        if (forumUrlInput) {
                            forumUrlInput.value = 'https://south-plus.org/thread.php?fid-48.html';
                        }
                        showStatus('Cookie 已保存');
                        window.setTimeout(() => window.location.reload(), 900);
                        return;
                    }

                    showStatus(result.data?.message || '请在弹出的浏览器窗口中登录，然后点击页面上的"已登录"按钮');
                } catch (error) {
                    showStatus(error instanceof Error ? error.message : '启动失败，请稍后重试。');
                } finally {
                    window.clearTimeout(pendingHintTimer);
                    btn?.removeAttribute('disabled');
                    btn?.classList.remove('cursor-not-allowed', 'opacity-60');
                }
            };

            browserLoginButton?.addEventListener('click', () => doBrowserLogin(false));
            forceBrowserLoginButton?.addEventListener('click', () => doBrowserLogin(true));

            form?.addEventListener('submit', async (event) => {
                event.preventDefault();

                const response = await fetch(state.apiPath, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        cookie: cookieInput?.value ?? '',
                        forumUrl: forumUrlInput?.value ?? '',
                        includeKeywords: includeKeywordsInput?.value ?? '',
                        excludeKeywords: excludeKeywordsInput?.value ?? '',
                        includeAuthors: includeAuthorsInput?.value ?? '',
                        excludeAuthors: excludeAuthorsInput?.value ?? '',
                        includeCategories: includeCategoriesInput?.value ?? '',
                        excludeCategories: excludeCategoriesInput?.value ?? '',
                    }),
                });

                const result = await response.json();
                if (!response.ok || result.code !== 0) {
                    showStatus(result.message || '保存失败，请检查 Cookie 和版块 URL。');
                    return;
                }

                showStatus('配置已保存，本地 RSS 转发现在会使用新的 South Plus Cookie。');
                window.setTimeout(() => window.location.reload(), 900);
            });
        })();
    `;

    return (
        <Layout title="South Plus Manager">
            <div
                className="min-h-screen"
                style={{
                    background:
                        'radial-gradient(circle at top left, rgba(198, 136, 99, 0.22), transparent 32%), radial-gradient(circle at top right, rgba(126, 165, 146, 0.18), transparent 28%), linear-gradient(180deg, #f4f1ea 0%, #ede7dc 48%, #e6dfd3 100%)',
                }}
            >
                <div className="mx-auto w-full max-w-6xl px-6 py-10">
                    <div className="mb-8 overflow-hidden rounded-[32px] border border-[#c9beab] bg-[#f8f4ec]/90 shadow-[0_20px_80px_rgba(69,53,37,0.12)]">
                        <div className="grid gap-8 p-8 lg:grid-cols-[1.2fr_0.8fr]">
                            <div>
                                <p className="mb-3 inline-flex rounded-full border border-[#8f7961] px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#6e5847]">JIS Local Forwarding</p>
                                <h1 className="text-4xl font-bold leading-tight text-[#33261b]">South Plus 本地转发管理界面</h1>
                                <p className="mt-4 max-w-2xl text-base leading-7 text-[#5d4b3c]">这个页面负责保存 South Plus Cookie、固定目标版块、输出本地 RSS 地址，并提供一套可直接接进 macOS LaunchAgent 的启动方式。</p>
                                <div className="mt-6 flex flex-wrap gap-3 text-sm font-medium">
                                    <a className="rounded-full bg-[#5f7f70] px-5 py-3 text-[#f9f4ee] transition hover:bg-[#4f6c5f]" href={localFeedUrl} target="_blank">
                                        打开本地 RSS
                                    </a>
                                    <a className="rounded-full border border-[#8f7961] px-5 py-3 text-[#5b4837] transition hover:bg-[#efe7da]" href="https://south-plus.org/thread.php?fid-48.html" target="_blank">
                                        打开源论坛
                                    </a>
                                    <a className="rounded-full border border-[#8f7961] px-5 py-3 text-[#5b4837] transition hover:bg-[#efe7da]" href={plistPath} target="_blank">
                                        下载 LaunchAgent plist
                                    </a>
                                </div>
                            </div>
                            <div className="rounded-[28px] border border-[#d3c8b7] bg-[#fffdf8] p-6">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="rounded-2xl bg-[#f1eadf] p-4">
                                        <p className="text-xs uppercase tracking-[0.2em] text-[#7f6b58]">配置状态</p>
                                        <p className="mt-2 text-2xl font-bold text-[#3b2e23]">{config.configured ? '已配置' : '未配置'}</p>
                                    </div>
                                    <div className="rounded-2xl bg-[#eef3ef] p-4">
                                        <p className="text-xs uppercase tracking-[0.2em] text-[#617765]">当前版块</p>
                                        <p className="mt-2 text-2xl font-bold text-[#274434]">fid {config.forumId}</p>
                                    </div>
                                    <div className="rounded-2xl bg-[#f7eee9] p-4">
                                        <p className="text-xs uppercase tracking-[0.2em] text-[#8f6651]">Cookie 摘要</p>
                                        <p className="mt-2 break-all text-sm font-semibold text-[#5f4334]">{config.cookiePreview}</p>
                                    </div>
                                    <div className="rounded-2xl bg-[#edf0f5] p-4">
                                        <p className="text-xs uppercase tracking-[0.2em] text-[#5a6677]">启用筛选</p>
                                        <p className="mt-2 text-2xl font-bold text-[#384353]">{config.activeFilterCount}</p>
                                    </div>
                                    <div className="rounded-2xl bg-[#eef3ef] p-4 sm:col-span-2">
                                        <p className="text-xs uppercase tracking-[0.2em] text-[#5a6677]">配置文件</p>
                                        <p className="mt-2 break-all text-sm font-semibold text-[#384353]">{configPath}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                        <section className="rounded-[28px] border border-[#cfc2b0] bg-[#fffdf8]/95 p-8 shadow-[0_14px_50px_rgba(64,49,34,0.08)]">
                            <div className="mb-6">
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8d745c]">Source Setup</p>
                                <h2 className="mt-2 text-2xl font-bold text-[#382a1f]">保存 South Plus Cookie 与目标版块</h2>
                            </div>
                            <form className="space-y-5" id="south-plus-config-form">
                                <label className="block">
                                    <span className="mb-2 block text-sm font-semibold text-[#5a4839]">South Plus 版块 URL</span>
                                    <input
                                        className="w-full rounded-2xl border border-[#d8cbb8] bg-[#fdfaf4] px-4 py-3 text-[#30261d] outline-none transition focus:border-[#7a6551] focus:ring-2 focus:ring-[#d8cab8]"
                                        id="forum-url"
                                        name="forumUrl"
                                        value={config.forumUrl}
                                    />
                                </label>
                                <label className="block">
                                    <span className="mb-2 block text-sm font-semibold text-[#5a4839]">South Plus Cookie</span>
                                    <textarea
                                        className="min-h-40 w-full rounded-2xl border border-[#d8cbb8] bg-[#fdfaf4] px-4 py-3 font-mono text-sm text-[#30261d] outline-none transition focus:border-[#7a6551] focus:ring-2 focus:ring-[#d8cab8]"
                                        id="cookie"
                                        name="cookie"
                                        placeholder="把浏览器里的完整 Cookie 粘贴到这里"
                                    ></textarea>
                                </label>
                                <p className="text-sm leading-7 text-[#64513f]">{config.configured ? '当前已有已保存的 Cookie；只有在你粘贴新的 Cookie 并保存时才会替换。' : '目前还没有保存 Cookie，先登录 South Plus 再把完整 Cookie 粘贴进来。'}</p>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <label className="block">
                                        <span className="mb-2 block text-sm font-semibold text-[#5a4839]">包含关键词</span>
                                        <textarea
                                            className="min-h-28 w-full rounded-2xl border border-[#d8cbb8] bg-[#fdfaf4] px-4 py-3 text-sm text-[#30261d] outline-none transition focus:border-[#7a6551] focus:ring-2 focus:ring-[#d8cab8]"
                                            id="include-keywords"
                                            name="includeKeywords"
                                            placeholder="只保留命中这些词的帖子，支持逗号或换行"
                                        >{config.filters.includeKeywords.join('\n')}</textarea>
                                    </label>
                                    <label className="block">
                                        <span className="mb-2 block text-sm font-semibold text-[#5a4839]">排除关键词</span>
                                        <textarea
                                            className="min-h-28 w-full rounded-2xl border border-[#d8cbb8] bg-[#fdfaf4] px-4 py-3 text-sm text-[#30261d] outline-none transition focus:border-[#7a6551] focus:ring-2 focus:ring-[#d8cab8]"
                                            id="exclude-keywords"
                                            name="excludeKeywords"
                                            placeholder="命中这些词的帖子会被排除"
                                        >{config.filters.excludeKeywords.join('\n')}</textarea>
                                    </label>
                                    <label className="block">
                                        <span className="mb-2 block text-sm font-semibold text-[#5a4839]">包含作者</span>
                                        <textarea
                                            className="min-h-28 w-full rounded-2xl border border-[#d8cbb8] bg-[#fdfaf4] px-4 py-3 text-sm text-[#30261d] outline-none transition focus:border-[#7a6551] focus:ring-2 focus:ring-[#d8cab8]"
                                            id="include-authors"
                                            name="includeAuthors"
                                            placeholder="只保留指定作者，支持部分匹配"
                                        >{config.filters.includeAuthors.join('\n')}</textarea>
                                    </label>
                                    <label className="block">
                                        <span className="mb-2 block text-sm font-semibold text-[#5a4839]">排除作者</span>
                                        <textarea
                                            className="min-h-28 w-full rounded-2xl border border-[#d8cbb8] bg-[#fdfaf4] px-4 py-3 text-sm text-[#30261d] outline-none transition focus:border-[#7a6551] focus:ring-2 focus:ring-[#d8cab8]"
                                            id="exclude-authors"
                                            name="excludeAuthors"
                                            placeholder="屏蔽指定作者"
                                        >{config.filters.excludeAuthors.join('\n')}</textarea>
                                    </label>
                                    <label className="block">
                                        <span className="mb-2 block text-sm font-semibold text-[#5a4839]">包含分类</span>
                                        <textarea
                                            className="min-h-28 w-full rounded-2xl border border-[#d8cbb8] bg-[#fdfaf4] px-4 py-3 text-sm text-[#30261d] outline-none transition focus:border-[#7a6551] focus:ring-2 focus:ring-[#d8cab8]"
                                            id="include-categories"
                                            name="includeCategories"
                                            placeholder="只保留指定分类"
                                        >{config.filters.includeCategories.join('\n')}</textarea>
                                    </label>
                                    <label className="block">
                                        <span className="mb-2 block text-sm font-semibold text-[#5a4839]">排除分类</span>
                                        <textarea
                                            className="min-h-28 w-full rounded-2xl border border-[#d8cbb8] bg-[#fdfaf4] px-4 py-3 text-sm text-[#30261d] outline-none transition focus:border-[#7a6551] focus:ring-2 focus:ring-[#d8cab8]"
                                            id="exclude-categories"
                                            name="excludeCategories"
                                            placeholder="屏蔽指定分类"
                                        >{config.filters.excludeCategories.join('\n')}</textarea>
                                    </label>
                                </div>
                                <p className="text-sm leading-7 text-[#64513f]">筛选会同时匹配帖子标题、作者、分类和正文内容。多个条件可以同时启用；包含条件不为空时，帖子必须命中对应字段才会进入 RSS。</p>
                                <div className="flex flex-wrap gap-3">
                                    <button className="rounded-full bg-[#9f5f3f] px-5 py-3 text-sm font-semibold text-[#fffaf4] transition hover:bg-[#8d5236]" type="submit">
                                        保存配置
                                    </button>
                                    <button className="rounded-full border border-[#8f7961] px-5 py-3 text-sm font-semibold text-[#5b4837] transition hover:bg-[#efe7da]" id="browser-login" type="button">
                                        自动获取 Cookie
                                    </button>
                                    <button className="rounded-full border border-[#b85c5c] px-5 py-3 text-sm font-semibold text-[#8b4040] transition hover:bg-[#f5e0e0]" id="force-browser-login" type="button">
                                        强制新开浏览器
                                    </button>
                                    <button className="rounded-full border border-[#8f7961] px-5 py-3 text-sm font-semibold text-[#5b4837] transition hover:bg-[#efe7da]" id="copy-feed-url" type="button">
                                        复制本地 RSS 地址
                                    </button>
                                </div>
                                <p className="hidden rounded-2xl border border-[#d7c6b2] bg-[#f4ede3] px-4 py-3 text-sm text-[#594637]" id="save-status"></p>
                            </form>
                        </section>

                        <section className="space-y-8">
                            <div className="rounded-[28px] border border-[#cfc2b0] bg-[#fffdf8]/95 p-8 shadow-[0_14px_50px_rgba(64,49,34,0.08)]">
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8d745c]">Local Feed</p>
                                <h2 className="mt-2 text-2xl font-bold text-[#382a1f]">固定本地 RSS 地址</h2>
                                <code className="mt-4 block rounded-2xl bg-[#efe7da] px-4 py-4 text-sm text-[#463629]">{localFeedUrl}</code>
                                <p className="mt-4 text-sm leading-7 text-[#64513f]">这个地址始终读取你当前保存的 South Plus 版块、Cookie 和筛选条件，不需要把登录态暴露到订阅器里。</p>
                                <p className="mt-3 text-sm leading-7 text-[#64513f]">当前已启用 {config.activeFilterCount} 个筛选词条，适合直接给 Follow、Miniflux 或 FreshRSS 订阅。</p>
                            </div>

                            <div className="rounded-[28px] border border-[#cfc2b0] bg-[#fffdf8]/95 p-8 shadow-[0_14px_50px_rgba(64,49,34,0.08)]">
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8d745c]">macOS Startup</p>
                                <h2 className="mt-2 text-2xl font-bold text-[#382a1f]">LaunchAgent 启动</h2>
                                <p className="mt-4 text-sm leading-7 text-[#64513f]">先在仓库里完成构建，再安装 LaunchAgent。后续登录 macOS 时会自动启动本地服务。</p>
                                <div className="mt-4 space-y-3 rounded-2xl bg-[#f3ece1] p-4 font-mono text-sm text-[#3d2f24]">
                                    {setupCommands.map((command) => (
                                        <div>{command}</div>
                                    ))}
                                </div>
                                <p className="mt-4 text-xs leading-6 text-[#7c6857]">仓库路径：{repoPath}</p>
                            </div>
                        </section>
                    </div>
                </div>
            </div>

            <script dangerouslySetInnerHTML={{ __html: bootScript }} />
            <script dangerouslySetInnerHTML={{ __html: interactionScript }} />
        </Layout>
    );
};

export default SouthPlusManagerPage;
