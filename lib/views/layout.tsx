import type { FC } from 'hono/jsx';

const themeBootScript = `
(() => {
    try {
        const storedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : prefersDark ? 'dark' : 'light';
        document.documentElement.classList.toggle('dark', theme === 'dark');
        document.documentElement.dataset.theme = theme;
    } catch {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', prefersDark);
        document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light';
    }
})();
`;

const themeToggleScript = `
(() => {
    const root = document.documentElement;
    const toggle = document.getElementById('theme-toggle');
    const icon = document.getElementById('theme-toggle-icon');
    const label = document.getElementById('theme-toggle-label');
    if (!toggle || !icon || !label) {
        return;
    }

    const syncThemeUi = () => {
        const isDark = root.classList.contains('dark');
        root.dataset.theme = isDark ? 'dark' : 'light';
        icon.textContent = isDark ? '☀' : '☾';
        label.textContent = isDark ? 'Light' : 'Dark';
        toggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
        toggle.setAttribute('title', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    };

    toggle.addEventListener('click', () => {
        const nextIsDark = !root.classList.contains('dark');
        root.classList.toggle('dark', nextIsDark);
        root.dataset.theme = nextIsDark ? 'dark' : 'light';
        try {
            localStorage.setItem('theme', nextIsDark ? 'dark' : 'light');
        } catch {}
        syncThemeUi();
    });

    syncThemeUi();
    window.requestAnimationFrame(() => {
        root.classList.add('theme-ready');
    });
})();
`;

export const Layout: FC<{ children: unknown; title?: string }> = (props) => (
    <html>
        <head>
            <title>{props.title ?? 'Welcome to RSSHub!'}</title>
            <meta content="width=device-width, initial-scale=1, viewport-fit=cover" name="viewport" />
            <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                {`
                html {
                    background: var(--background, #ffffff);
                    color: var(--foreground, #18181b);
                }
                details::-webkit-scrollbar {
                    width: 0.25rem;
                }
                details::-webkit-scrollbar-thumb {
                    border-radius: 0.125rem;
                    background-color: #e4e4e7;
                }
                details::-webkit-scrollbar-thumb:hover {
                    background-color: #a1a1aa;
                }

                @font-face {
                    font-family: SN Pro;
                    font-style: normal;
                    font-display: swap;
                    font-weight: 400;
                    src: url(https://cdn.jsdelivr.net/fontsource/fonts/sn-pro@latest/latin-400-normal.woff2) format(woff2);
                }
                @font-face {
                    font-family: SN Pro;
                    font-style: normal;
                    font-display: swap;
                    font-weight: 500;
                    src: url(https://cdn.jsdelivr.net/fontsource/fonts/sn-pro@latest/latin-500-normal.woff2) format(woff2);
                }
                @font-face {
                    font-family: SN Pro;
                    font-style: normal;
                    font-display: swap;
                    font-weight: 700;
                    src: url(https://cdn.jsdelivr.net/fontsource/fonts/sn-pro@latest/latin-700-normal.woff2) format(woff2);
                }
                body {
                    font-family: SN Pro, sans-serif;
                    background: var(--background, #ffffff);
                    color: var(--foreground, #18181b);
                }
                html.theme-ready body,
                html.theme-ready [data-theme='jis'],
                html.theme-ready [data-theme='jis'] * {
                    transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, fill 0.2s ease, stroke 0.2s ease, box-shadow 0.2s ease;
                }
                .theme-toggle {
                    position: fixed;
                    top: max(1rem, env(safe-area-inset-top, 0px) + 0.75rem);
                    right: max(1rem, env(safe-area-inset-right, 0px) + 0.75rem);
                    z-index: 60;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    min-height: 44px;
                    padding: 0.625rem 0.875rem;
                    border-radius: 999px;
                    border: 1px solid color-mix(in srgb, var(--jis-blue, #2563eb) 24%, var(--border, #dbe3ef));
                    background: color-mix(in srgb, var(--card, #ffffff) 88%, transparent);
                    color: var(--foreground, #18181b);
                    backdrop-filter: blur(16px);
                    box-shadow: 0 12px 30px color-mix(in srgb, var(--jis-bg, #ffffff) 50%, transparent);
                }
                .theme-toggle:hover {
                    background: color-mix(in srgb, var(--muted, #f1f5f9) 78%, var(--card, #ffffff));
                }
                .theme-toggle:focus-visible {
                    outline: 2px solid var(--jis-blue, #2563eb);
                    outline-offset: 2px;
                }
                .theme-toggle-icon {
                    display: inline-flex;
                    width: 1.25rem;
                    justify-content: center;
                    font-size: 1rem;
                    line-height: 1;
                }
                .theme-toggle-label {
                    font-size: 0.875rem;
                    font-weight: 600;
                }
                @media (max-width: 640px) {
                    .theme-toggle {
                        padding: 0.625rem 0.75rem;
                    }
                    .theme-toggle-label {
                        display: none;
                    }
                }
                `}
            </style>
        </head>
        <body className="antialiased min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
            <button className="theme-toggle" id="theme-toggle" type="button">
                <span aria-hidden="true" className="theme-toggle-icon" id="theme-toggle-icon">
                    ☾
                </span>
                <span className="theme-toggle-label" id="theme-toggle-label">
                    Dark
                </span>
            </button>
            {props.children}
            <script dangerouslySetInnerHTML={{ __html: themeToggleScript }} />
        </body>
    </html>
);
