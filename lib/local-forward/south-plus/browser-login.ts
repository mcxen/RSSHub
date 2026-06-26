import { constants } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import { open, rm } from 'node:fs/promises';

import { chromium } from 'playwright';
import type { Browser, Cookie, Page } from 'playwright';

import { readSouthPlusConfig, saveSouthPlusConfig } from './store';
import { southPlusRootUrl } from './shared';

declare global {
    interface Window {
        southPlusExtractCookie: () => Promise<void>;
    }
}

const southPlusLoginUrl = `${southPlusRootUrl}/login.php`;
const southPlusBrowserLoginForumUrl = `${southPlusRootUrl}/thread.php?fid-48.html`;
const southPlusBrowserLoginLockPath = '/tmp/south-plus-browser-login.lock';
const southPlusBrowserLoginTimeout = 600_000;

let activeBrowser: Browser | undefined;

const forceKillExistingBrowser = async () => {
    if (activeBrowser) {
        await activeBrowser.close().catch(() => undefined);
        activeBrowser = undefined;
    }
    await rm(southPlusBrowserLoginLockPath, { force: true });
    await new Promise((resolve) => setTimeout(resolve, 500));
};

type SouthPlusBrowserLoginResult =
    | {
          status: 'success';
          message: string;
          cookie: string;
      }
    | {
          status: 'error' | 'busy';
          message: string;
      };

const buildSouthPlusCookieString = (cookies: Cookie[]) =>
    cookies
        .filter((cookie) => cookie.domain.includes('south-plus'))
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join('; ');

const withSouthPlusBrowserLoginLock = async <T>(task: () => Promise<T>, force?: boolean): Promise<T | SouthPlusBrowserLoginResult> => {
    if (force) {
        await forceKillExistingBrowser();
    }

    let lockReleased = false;
    let lockHandle: FileHandle | undefined;

    try {
        lockHandle = await open(southPlusBrowserLoginLockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
            return {
                status: 'busy',
                message: '已有登录进程在运行',
            };
        }

        throw error;
    }

    const releaseLock = async () => {
        if (lockReleased) {
            return;
        }

        lockReleased = true;
        await lockHandle?.close();
        await rm(southPlusBrowserLoginLockPath, { force: true });
    };

    try {
        return await task();
    } finally {
        await releaseLock();
    }
};

const launchBrowserLoginAndExtractCookie = async (force?: boolean): Promise<SouthPlusBrowserLoginResult> => {
    const result = await withSouthPlusBrowserLoginLock(async () => {
        let browser: Browser | undefined;
        let page: Page | undefined;
        let timeoutId: NodeJS.Timeout | undefined;
        let resolved = false;
        let resolveResult: ((value: SouthPlusBrowserLoginResult) => void) | undefined;

        const finalize = async (payload: SouthPlusBrowserLoginResult) => {
            if (resolved) {
                return payload;
            }

            resolved = true;

            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            await page?.close().catch(() => undefined);
            if (browser) {
                await browser.close().catch(() => undefined);
                if (activeBrowser === browser) {
                    activeBrowser = undefined;
                }
            }

            resolveResult?.(payload);
            return payload;
        };

        try {
            browser = await chromium.launch({
                headless: false,
                args: ['--window-size=1280,800'],
            });
            activeBrowser = browser;
            page = await browser.newPage({
                viewport: {
                    width: 1280,
                    height: 800,
                },
            });
            const activePage = page;

            const loginCompleted = new Promise<SouthPlusBrowserLoginResult>((resolve) => {
                resolveResult = resolve;
                timeoutId = setTimeout(() => {
                    void finalize({
                        status: 'error',
                        message: '登录超时，请在 10 分钟内完成登录并点击页面按钮。',
                    });
                }, southPlusBrowserLoginTimeout);
            });

            await activePage.exposeFunction('southPlusExtractCookie', async () => {
                const cookies = await activePage.context().cookies();
                const cookieString = buildSouthPlusCookieString(cookies);

                if (!cookieString) {
                    return finalize({
                        status: 'error',
                        message: '未提取到 south-plus.org Cookie，请确认当前已登录。',
                    });
                }

                const existingConfig = await readSouthPlusConfig();
                await saveSouthPlusConfig({
                    cookie: cookieString,
                    forumUrl: southPlusBrowserLoginForumUrl,
                    includeKeywords: existingConfig.includeKeywords,
                    excludeKeywords: existingConfig.excludeKeywords,
                    includeAuthors: existingConfig.includeAuthors,
                    excludeAuthors: existingConfig.excludeAuthors,
                    includeCategories: existingConfig.includeCategories,
                    excludeCategories: existingConfig.excludeCategories,
                    updatedAt: new Date().toISOString(),
                });

                return finalize({
                    status: 'success',
                    message: 'Cookie 已保存',
                    cookie: cookieString,
                });
            });

            const injectExtractButton = async () => {
                await activePage.evaluate(() => {
                    const existingButton = document.getElementById('south-plus-cookie-extract-button');
                    if (existingButton) {
                        return;
                    }

                    const button = document.createElement('button');
                    button.id = 'south-plus-cookie-extract-button';
                    button.type = 'button';
                    button.textContent = '已登录，点击提取 Cookie';
                    button.style.position = 'fixed';
                    button.style.top = '24px';
                    button.style.right = '24px';
                    button.style.zIndex = '2147483647';
                    button.style.padding = '12px 18px';
                    button.style.border = '0';
                    button.style.borderRadius = '999px';
                    button.style.background = '#9f5f3f';
                    button.style.color = '#fffaf4';
                    button.style.fontSize = '14px';
                    button.style.fontWeight = '700';
                    button.style.boxShadow = '0 16px 36px rgba(0, 0, 0, 0.2)';
                    button.style.cursor = 'pointer';
                    button.addEventListener('click', () => {
                        button.textContent = '正在提取 Cookie...';
                        button.setAttribute('disabled', 'true');
                        button.style.opacity = '0.8';
                        void window.southPlusExtractCookie();
                    });
                    document.body.append(button);
                }).catch(() => undefined);
            };

            activePage.on('load', () => {
                void injectExtractButton();
            });

            await activePage.goto(southPlusLoginUrl, {
                waitUntil: 'domcontentloaded',
            });
            await injectExtractButton();

            return await loginCompleted;
        } catch (error) {
            return await finalize({
                status: 'error',
                message: error instanceof Error ? error.message : '启动浏览器登录失败。',
            });
        }
    });

    return result;
};

export { launchBrowserLoginAndExtractCookie };
export type { SouthPlusBrowserLoginResult };
