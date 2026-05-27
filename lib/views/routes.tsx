import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { FC } from 'hono/jsx';

import { namespaces } from '@/registry';
import type { Category, Route } from '@/types';
import { Layout } from '@/views/layout';

interface RouteCard {
    namespace: string;
    path: string;
    name: string;
    description?: string;
    maintainers: string[];
    example: string;
    categories?: Category[];
    features?: Route['features'];
}

interface FeedItem {
    name: string;
    url: string;
    enabled: boolean;
}

function getRoutesData(): RouteCard[] {
    const routes: RouteCard[] = [];
    for (const [nsName, nsData] of Object.entries(namespaces)) {
        if (!nsData?.routes) {
            continue;
        }
        for (const [routePath, route] of Object.entries(nsData.routes)) {
            routes.push({
                namespace: nsName,
                path: routePath,
                name: route.name,
                description: route.description,
                maintainers: route.maintainers ?? [],
                example: route.example,
                categories: route.categories,
                features: route.features,
            });
        }
    }
    return routes;
}

function getFeeds(): FeedItem[] {
    try {
        const feedsPath = path.join(import.meta.dirname, '..', 'routes', 'feeds.json');
        return JSON.parse(readFileSync(feedsPath, 'utf-8')) as FeedItem[];
    } catch {
        return [];
    }
}

const featureLabels: Record<string, string> = {
    nsfw: 'NSFW',
    antiCrawler: 'Anti-Crawl',
    requirePuppeteer: 'Puppeteer',
    supportRadar: 'Radar',
    supportBT: 'BT',
    supportPodcast: 'Podcast',
    supportScihub: 'Sci-Hub',
};

const categoryBadgeClasses: Record<string, string> = {
    popular: 'border-[#E6001244] bg-[#E6001222] text-[#E60012]',
    'social-media': 'border-[#1971FF44] bg-[#1971FF22] text-[#1971FF]',
    'new-media': 'border-[#7C3AED44] bg-[#7C3AED22] text-[#7C3AED]',
    'traditional-media': 'border-[#6B728044] bg-[#6B728022] text-[#6B7280]',
    bbs: 'border-[#10B98144] bg-[#10B98122] text-[#10B981]',
    blog: 'border-[#F59E0B44] bg-[#F59E0B22] text-[#F59E0B]',
    programming: 'border-[#3B82F644] bg-[#3B82F622] text-[#3B82F6]',
    design: 'border-[#EC489944] bg-[#EC489922] text-[#EC4899]',
    live: 'border-[#EF444444] bg-[#EF444422] text-[#EF4444]',
    multimedia: 'border-[#8B5CF644] bg-[#8B5CF622] text-[#8B5CF6]',
    picture: 'border-[#14B8A644] bg-[#14B8A622] text-[#14B8A6]',
    anime: 'border-[#F9731644] bg-[#F9731622] text-[#F97316]',
    'program-update': 'border-[#22C55E44] bg-[#22C55E22] text-[#22C55E]',
    university: 'border-[#2563EB44] bg-[#2563EB22] text-[#2563EB]',
    forecast: 'border-[#06B6D444] bg-[#06B6D422] text-[#06B6D4]',
    travel: 'border-[#84CC1644] bg-[#84CC1622] text-[#84CC16]',
    shopping: 'border-[#D946EF44] bg-[#D946EF22] text-[#D946EF]',
    game: 'border-[#6366F144] bg-[#6366F122] text-[#6366F1]',
    reading: 'border-[#A855F744] bg-[#A855F722] text-[#A855F7]',
    government: 'border-[#64748B44] bg-[#64748B22] text-[#64748B]',
    study: 'border-[#0EA5E944] bg-[#0EA5E922] text-[#0EA5E9]',
    journal: 'border-[#78716C44] bg-[#78716C22] text-[#78716C]',
    finance: 'border-[#16A34A44] bg-[#16A34A22] text-[#16A34A]',
    sport: 'border-[#DC262644] bg-[#DC262622] text-[#DC2626]',
    other: 'border-[#9CA3AF44] bg-[#9CA3AF22] text-[#9CA3AF]',
};

const featureBadgeClasses: Record<string, string> = {
    nsfw: 'border-[rgba(220,38,38,0.4)] bg-[rgba(220,38,38,0.2)] text-[#F87171]',
    antiCrawler: 'border-[rgba(234,88,12,0.4)] bg-[rgba(234,88,12,0.2)] text-[#FB923C]',
    requirePuppeteer: 'border-[rgba(147,51,234,0.4)] bg-[rgba(147,51,234,0.2)] text-[#C084FC]',
    supportRadar: 'border-[rgba(37,99,235,0.3)] bg-[rgba(37,99,235,0.15)] text-[#818CF8]',
    supportBT: 'border-[rgba(37,99,235,0.3)] bg-[rgba(37,99,235,0.15)] text-[#818CF8]',
    supportPodcast: 'border-[rgba(37,99,235,0.3)] bg-[rgba(37,99,235,0.15)] text-[#818CF8]',
    supportScihub: 'border-[rgba(37,99,235,0.3)] bg-[rgba(37,99,235,0.15)] text-[#818CF8]',
};

const cardClass = 'rounded-lg border border-[var(--border)] bg-[var(--card)] transition-colors hover:border-[color-mix(in_srgb,var(--jis-accent)_30%,transparent)]';
const inputClass =
    'flex min-h-[44px] w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--jis-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]';
const primaryButtonClass =
    'inline-flex min-h-[44px] items-center justify-center rounded-md bg-[var(--jis-accent)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jis-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-50';
const secondaryButtonClass =
    'inline-flex min-h-[44px] items-center justify-center rounded-md border border-[var(--border)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--jis-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]';

const RoutesView: FC<{ baseUrl?: string }> = ({ baseUrl = '' }) => {
    const routes = getRoutesData();
    const feeds = getFeeds();
    const totalRoutes = routes.length;

    const routesJsonEscaped = JSON.stringify(routes).replaceAll('<', String.raw`\u003c`);
    const feedsJsonEscaped = JSON.stringify(feeds).replaceAll('<', String.raw`\u003c`);

    return (
        <Layout title="RSSHub Route Console">
            <div class="routes-console min-h-screen bg-[var(--jis-bg)] pb-[env(safe-area-inset-bottom,16px)] font-mono text-[var(--jis-fg)]" data-theme="jis">
                <style>{`
          .routes-console {
            --radius: 0.5rem;
            --radius-lg: 0.75rem;
            --radius-xl: 1rem;
            --routes-breakpoint-mobile: 768px;
            --routes-breakpoint-compact: 480px;
            --routes-space-1: 0.5rem;
            --routes-space-2: 0.75rem;
            --routes-space-3: 1rem;
            --routes-space-4: 1.25rem;
            --routes-space-5: 1.5rem;
            --routes-space-6: 2rem;
            --routes-touch-target: 44px;
            --routes-sidebar-width: min(88vw, 360px);
            --routes-bottom-nav-height: 68px;
            --routes-font-title: clamp(1.2rem, 1rem + 1vw, 1.75rem);
            --routes-font-body: clamp(0.8125rem, 0.77rem + 0.18vw, 0.875rem);
            --routes-font-meta: clamp(0.75rem, 0.72rem + 0.16vw, 0.8125rem);
            --routes-font-code: clamp(0.8125rem, 0.78rem + 0.18vw, 0.9375rem);
          }

          .routes-console .routes-hero h1 {
            font-size: var(--routes-font-title);
          }

          .routes-console .routes-search input,
          .routes-console .routes-search button,
          .routes-console .translate-btn,
          .routes-console .feed-remove-btn,
          .routes-console .feed-toggle-label,
          .routes-console .routes-mobile-icon-btn,
          .routes-console .route-card-toggle,
          .routes-console .route-mobile-summary {
            min-height: var(--routes-touch-target);
          }

          .routes-console .translate-btn,
          .routes-console .feed-remove-btn,
          .routes-console .routes-mobile-icon-btn {
            min-width: var(--routes-touch-target);
          }

          .routes-console .route-card {
            position: relative;
          }

          .routes-console .route-card code {
            font-size: var(--routes-font-code);
            word-break: break-all;
          }

          .routes-console .route-card a,
          .routes-console .route-card .route-desc,
          .routes-console .route-card .route-name-en,
          .routes-console .routes-sidebar,
          .routes-console .routes-search input,
          .routes-console .routes-search button {
            font-size: var(--routes-font-body);
          }

          .routes-console .route-card .route-name-zh {
            font-size: clamp(0.95rem, 0.9rem + 0.2vw, 1rem);
          }

          .routes-console .route-card .route-mobile-summary,
          .routes-console .route-card-toggle,
          .routes-console .routes-mobile-shell,
          .routes-console .routes-bottom-nav,
          .routes-console .routes-sidebar-backdrop,
          .routes-console .routes-sidebar-toggle,
          .routes-console .routes-search-toggle {
            display: none;
          }

          @media (hover: hover) {
            .routes-console .route-card:hover {
              border-color: color-mix(in srgb, var(--jis-accent) 30%, transparent);
              background-color: color-mix(in srgb, var(--jis-accent) 4%, transparent);
            }
          }

          @media (max-width: 768px) {
            .routes-console {
              padding-bottom: calc(var(--routes-bottom-nav-height) + env(safe-area-inset-bottom, 0px));
            }

            .routes-console .routes-hero {
              padding: var(--routes-space-4) var(--routes-space-3) var(--routes-space-3) !important;
            }

            .routes-console .routes-hero > div {
              align-items: flex-start;
              gap: var(--routes-space-3);
            }

            .routes-console .routes-hero-meta {
              flex-wrap: wrap;
              width: 100%;
              justify-content: space-between;
            }

            .routes-console .routes-mobile-shell {
              display: flex;
              align-items: center;
              gap: var(--routes-space-2);
            }

            .routes-console .routes-mobile-icon-btn {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              padding: 0 var(--routes-space-3);
              border-radius: 9999px;
              border: 1px solid color-mix(in srgb, var(--jis-blue) 28%, transparent);
              background: color-mix(in srgb, var(--jis-blue) 10%, transparent);
              color: color-mix(in srgb, var(--jis-blue) 80%, var(--foreground));
              font-family: inherit;
              font-size: var(--routes-font-meta);
              cursor: pointer;
            }

            .routes-console .routes-search {
              position: sticky;
              top: 0;
              z-index: 15;
              backdrop-filter: blur(18px);
              background: color-mix(in srgb, var(--jis-bg) 96%, transparent);
              padding: 0 var(--routes-space-3);
              max-height: 0;
              overflow: hidden;
              border-bottom-color: transparent;
              transition: max-height 0.24s ease, padding-top 0.24s ease, padding-bottom 0.24s ease,
                border-color 0.24s ease;
            }

            .routes-console[data-search-open='true'] .routes-search {
              padding-top: var(--routes-space-3);
              padding-bottom: var(--routes-space-3);
              max-height: 18rem;
              border-bottom-color: color-mix(in srgb, var(--jis-blue) 10%, transparent);
            }

            .routes-console .routes-search > div {
              flex-direction: column;
              align-items: stretch;
              gap: var(--routes-space-2);
            }

            .routes-console .routes-search input,
            .routes-console .routes-search button {
              width: 100%;
              box-sizing: border-box;
              flex: none;
              min-width: 0;
            }

            .routes-console .routes-main {
              padding: var(--routes-space-3) !important;
              gap: var(--routes-space-3) !important;
            }

            .routes-console .routes-list {
              width: 100%;
            }

            .routes-console .route-card {
              padding: var(--routes-space-3) !important;
              margin-bottom: var(--routes-space-2) !important;
            }

            .routes-console .route-card-header {
              display: none;
            }

            .routes-console .route-card-topline {
              margin-bottom: 0;
            }

            .routes-console .route-mobile-summary {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: var(--routes-space-2);
              width: 100%;
              padding: 0;
              margin: 0 0 var(--routes-space-2);
              border: 0;
              background: transparent;
              color: inherit;
              text-align: left;
              cursor: pointer;
            }

            .routes-console .route-mobile-summary-main {
              min-width: 0;
              display: grid;
              gap: 0.25rem;
            }

            .routes-console .route-mobile-summary-path {
              color: var(--jis-accent);
              font-family: monospace;
              font-size: var(--routes-font-code);
              line-height: 1.4;
              word-break: break-all;
            }

            .routes-console .route-mobile-summary-name {
              color: var(--jis-fg);
              font-size: clamp(0.95rem, 0.9rem + 0.3vw, 1rem);
              font-weight: 600;
            }

            .routes-console .route-card-toggle {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              width: var(--routes-touch-target);
              border-radius: 9999px;
              border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
              background: color-mix(in srgb, var(--card) 78%, transparent);
              color: var(--muted-foreground);
              font-size: 1.1rem;
            }

            .routes-console .route-card[data-mobile-expanded='false'] .route-card-details {
              display: none;
            }

            .routes-console .route-card[data-mobile-expanded='true'] .route-card-toggle {
              color: var(--jis-accent);
              border-color: color-mix(in srgb, var(--jis-accent) 28%, transparent);
              background: color-mix(in srgb, var(--jis-accent) 8%, transparent);
            }

            .routes-console .route-card .route-desc {
              display: inline-block;
              margin-top: 0.35rem;
              margin-left: 0 !important;
            }

            .routes-console .route-card .translate-btn {
              margin-left: 0.5rem !important;
              padding: 0.25rem 0.6rem !important;
            }

            .routes-console .routes-sidebar-backdrop {
              display: block;
              position: fixed;
              inset: 0;
              background: color-mix(in srgb, var(--jis-bg) 58%, transparent);
              opacity: 0;
              pointer-events: none;
              transition: opacity 0.24s ease;
              z-index: 24;
            }

            .routes-console .routes-sidebar {
              position: fixed !important;
              top: 0 !important;
              right: 0;
              bottom: 0;
              width: var(--routes-sidebar-width) !important;
              max-width: var(--routes-sidebar-width);
              border-radius: 1rem 0 0 1rem !important;
              padding: calc(var(--routes-space-6) + env(safe-area-inset-top, 0px)) var(--routes-space-4)
                calc(var(--routes-space-5) + env(safe-area-inset-bottom, 0px)) !important;
              overflow-y: auto;
              background: color-mix(in srgb, var(--jis-bg) 98%, transparent) !important;
              box-shadow: -16px 0 36px color-mix(in srgb, var(--jis-bg) 50%, transparent);
              transform: translateX(100%);
              transition: transform 0.24s ease;
              z-index: 25;
            }

            .routes-console[data-sidebar-open='true'] .routes-sidebar {
              transform: translateX(0);
            }

            .routes-console[data-sidebar-open='true'] .routes-sidebar-backdrop {
              opacity: 1;
              pointer-events: auto;
            }

            .routes-console .routes-bottom-nav {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 0.5rem;
              position: fixed;
              left: 0;
              right: 0;
              bottom: 0;
              z-index: 30;
              padding: 0.75rem var(--routes-space-3) calc(0.75rem + env(safe-area-inset-bottom, 0px));
              background: linear-gradient(180deg, color-mix(in srgb, var(--background) 90%, transparent), color-mix(in srgb, var(--card) 94%, var(--background)));
              border-top: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
              backdrop-filter: blur(18px);
            }

            .routes-console .routes-bottom-nav button,
            .routes-console .routes-bottom-nav div {
              min-height: var(--routes-touch-target);
              border-radius: 9999px;
              border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
              background: color-mix(in srgb, var(--card) 80%, transparent);
              color: var(--foreground);
              font-family: inherit;
              font-size: var(--routes-font-meta);
            }

            .routes-console .routes-bottom-nav button {
              cursor: pointer;
            }

            .routes-console .routes-bottom-nav div {
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 0 var(--routes-space-2);
              color: var(--jis-accent);
              font-weight: 600;
            }

            .routes-console .feed-toggle-label {
              min-width: var(--routes-touch-target);
            }
          }

          @media (max-width: 480px) {
            .routes-console .routes-hero {
              padding: var(--routes-space-3) var(--routes-space-2) !important;
            }

            .routes-console .routes-main {
              padding: var(--routes-space-2) !important;
            }

            .routes-console .route-card {
              padding: var(--routes-space-2) !important;
            }

            .routes-console .routes-sidebar {
              width: min(92vw, 340px) !important;
            }
          }
        `}</style>
                {/* Hero Header */}
                <div class="routes-hero border-b border-[color-mix(in_srgb,var(--jis-accent)_30%,transparent)] px-4 py-6 md:px-6 md:py-8">
                    <div class="mx-auto flex max-w-[1400px] flex-col items-start gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-4">
                        <div class="min-w-0 max-w-full break-words">
                            <h1 class="m-0 text-[clamp(1.2rem,1rem+1vw,1.75rem)] font-bold tracking-tight text-[var(--jis-accent)]">{'> '}RSSHub Route Console</h1>
                            <p class="mt-1 break-words whitespace-normal text-sm md:text-base text-[var(--muted-foreground)]">terminal://rsshub/routes</p>
                        </div>
                        <div class="routes-mobile-shell">
                            <button id="mobile-sidebar-toggle" class="routes-mobile-icon-btn routes-sidebar-toggle" type="button">
                                ☰ Feeds
                            </button>
                        </div>
                        <div class="routes-hero-meta flex w-full flex-col items-start gap-3 md:w-auto md:flex-row md:items-center">
                            <span
                                id="route-count"
                                class="inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-[var(--jis-accent)] px-3 py-1 text-sm md:text-base font-bold text-[var(--primary-foreground)] md:w-auto"
                            >
                                {totalRoutes} routes
                            </span>
                            <a
                                href="/"
                                class="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--jis-blue)_30%,transparent)] px-3 py-1 text-sm md:text-base text-[var(--jis-blue)] no-underline transition-colors hover:bg-[var(--muted)] md:w-auto"
                            >
                                &larr; Home
                            </a>
                        </div>
                    </div>
                </div>
                <div class="routes-sidebar-backdrop" id="routes-sidebar-backdrop"></div>

                {/* Search + Import Bar */}
                <div class="routes-search border-b border-[color-mix(in_srgb,var(--jis-blue)_10%,transparent)] px-4 py-4 md:px-6">
                    <div class="mx-auto flex w-full max-w-[1400px] flex-col items-stretch gap-3 md:flex-row md:flex-wrap md:items-center">
                        <input
                            id="search-input"
                            type="text"
                            placeholder="Filter routes..."
                            class={`${inputClass} min-w-0 w-full flex-[1_1_250px] border-[color-mix(in_srgb,var(--jis-blue)_30%,transparent)] bg-[color-mix(in_srgb,var(--card)_92%,var(--muted))] text-sm md:text-base`}
                        />
                        <input
                            id="import-input"
                            type="text"
                            placeholder="Paste RSSHub URL to find route..."
                            class={`${inputClass} min-w-0 w-full flex-[2_1_350px] border-[color-mix(in_srgb,var(--jis-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--card)_92%,var(--muted))] text-sm md:text-base`}
                        />
                        <button id="import-btn" class={`${primaryButtonClass} min-h-[44px] w-full whitespace-normal break-words border-0 md:w-auto`}>
                            Import
                        </button>
                        <button id="clear-filter" class={`${secondaryButtonClass} min-h-[44px] w-full whitespace-normal break-words px-3 text-sm md:w-auto md:text-base text-[var(--muted-foreground)]`}>
                            Clear
                        </button>
                    </div>
                </div>

                {/* Main Content + Sidebar */}
                <div class="routes-main mx-auto flex max-w-[1400px] items-start gap-6 px-4 py-4 md:px-6 md:py-6">
                    {/* Route Cards */}
                    <div id="route-list" class="routes-list min-w-0 flex-[1_1_0]">
                        <div id="no-results" class="hidden py-12 text-center text-[var(--muted-foreground)]">
                            No routes match your filter.
                        </div>
                        {routes.map((route, idx) => {
                            const fullPath = `/${route.namespace}${route.path}`;
                            const exampleUrl = baseUrl ? `${baseUrl}${route.example}` : route.example;

                            return (
                                <div
                                    class={`route-card ${cardClass} mb-3 max-w-full overflow-hidden break-words bg-[color-mix(in_srgb,var(--card)_96%,var(--background))] p-4 sm:p-5`}
                                    data-mobile-expanded="false"
                                    data-namespace={route.namespace}
                                    data-path={fullPath}
                                    data-text={`${route.namespace} ${route.path} ${route.name} ${route.description ?? ''} ${route.maintainers.join(' ')} ${(route.categories ?? []).join(' ')}`.toLowerCase()}
                                >
                                    <button type="button" class="route-mobile-summary">
                                        <span class="route-mobile-summary-main max-w-full break-words">
                                            <span class="route-mobile-summary-path break-words whitespace-normal">{fullPath}</span>
                                            <span class="route-mobile-summary-name break-words whitespace-normal">{route.name}</span>
                                        </span>
                                        <span class="route-card-toggle" aria-hidden="true">
                                            +
                                        </span>
                                    </button>

                                    {/* Header row: path + namespace */}
                                    <div class="route-card-header mb-2 flex flex-wrap items-center gap-2">
                                        <code class="break-all text-sm md:text-base font-bold text-[var(--jis-accent)]">{fullPath}</code>
                                        <span class="inline-flex items-center rounded-md bg-[color-mix(in_srgb,var(--card)_82%,var(--muted))] px-1.5 py-0.5 text-[0.675rem] text-[var(--muted-foreground)]">{route.namespace}</span>
                                    </div>

                                    {/* Name + Description */}
                                    <div class="route-card-details">
                                        <div class="route-card-topline mb-2">
                                            <span class="route-name-zh break-words whitespace-normal text-sm md:text-base font-semibold text-[var(--jis-fg)]">{route.name}</span>
                                            {route.description && <span class="route-desc ml-3 break-words whitespace-normal text-sm md:text-base text-[var(--muted-foreground)]">{route.description}</span>}
                                            <span class="route-name-en ml-2 hidden text-[0.875rem] font-medium text-[var(--jis-blue)]"></span>
                                            <button
                                                class="translate-btn ml-2 inline-flex min-h-[44px] items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--jis-blue)_25%,transparent)] bg-[color-mix(in_srgb,var(--jis-blue)_15%,transparent)] px-2 py-1 text-sm text-[var(--jis-blue)] transition-colors hover:bg-[color-mix(in_srgb,var(--jis-blue)_22%,transparent)] md:text-base"
                                                data-idx={idx}
                                                data-text={route.description ? `${route.name} - ${route.description}` : route.name}
                                            >
                                                EN
                                            </button>
                                        </div>

                                        {/* Example URL */}
                                        <div class="mb-2 break-words whitespace-normal text-sm md:text-base">
                                            <span class="text-[var(--muted-foreground)]">example: </span>
                                            <a href={exampleUrl} target="_blank" class="break-all whitespace-normal text-sm md:text-base text-[var(--jis-blue)] no-underline hover:underline">
                                                {exampleUrl}
                                            </a>
                                        </div>

                                        {/* Maintainers */}
                                        <div class="mb-2 text-[0.8125rem]">
                                            <span class="text-[var(--muted-foreground)]">maintainers: </span>
                                            {route.maintainers.length > 0 ? (
                                                route.maintainers.map((m, mi) => (
                                                    <>
                                                        {mi > 0 && ', '}
                                                        <span class="text-[0.75rem] text-[var(--jis-blue)]">@{m}</span>
                                                    </>
                                                ))
                                            ) : (
                                                <span class="text-[#555]">—</span>
                                            )}
                                        </div>

                                        {/* Categories + Features */}
                                        <div class="flex flex-wrap items-center gap-1.5">
                                            {/* Categories */}
                                            {route.categories?.map((cat) => (
                                                <span
                                                    class={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.03em] ${categoryBadgeClasses[cat] ?? categoryBadgeClasses.other}`}
                                                >
                                                    {cat}
                                                </span>
                                            ))}

                                            {/* Feature flags */}
                                            {route.features &&
                                                Object.entries(route.features)
                                                    .filter(([, v]) => v === true)
                                                    .map(([key]) => (
                                                        <span
                                                            class={`inline-flex items-center rounded-md border px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.03em] ${featureBadgeClasses[key] ?? featureBadgeClasses.supportRadar}`}
                                                        >
                                                            {featureLabels[key] ?? key}
                                                        </span>
                                                    ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Sidebar: Feed Config */}
                    <div class={`routes-sidebar ${cardClass} sticky top-4 w-80 flex-shrink-0 bg-[color-mix(in_srgb,var(--card)_96%,var(--background))] p-5`}>
                        <h2 class="mb-3 mt-0 text-base font-bold text-[var(--jis-accent)]">RSS Feed Config</h2>
                        <p class="mb-4 text-xs text-[var(--muted-foreground)]">Configured feeds from feeds.json</p>

                        {/* Feed List */}
                        <div id="feed-list" class="mb-4">
                            {feeds.map((feed, fi) => (
                                <div class="feed-item flex items-center justify-between gap-2 border-b border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] py-2" data-index={fi}>
                                    <div class="min-w-0 flex-[1_1_auto]">
                                        <div class={`truncate text-[0.8125rem] font-medium ${feed.enabled ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>{feed.name}</div>
                                        <div class="truncate text-[0.6875rem] text-[var(--muted-foreground)]">{feed.url}</div>
                                    </div>
                                    <label class="feed-toggle-label flex flex-shrink-0 cursor-pointer items-center gap-1">
                                        <input type="checkbox" class="feed-toggle h-4 w-4 accent-[var(--jis-accent)]" data-index={fi} checked={feed.enabled} />
                                        <span class="text-[0.625rem] text-[var(--muted-foreground)]">{feed.enabled ? 'ON' : 'OFF'}</span>
                                    </label>
                                    <button
                                        class="feed-remove-btn inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-md px-1 text-xs text-[var(--jis-red)] transition-colors hover:bg-[color-mix(in_srgb,var(--jis-red)_15%,transparent)]"
                                        data-index={fi}
                                    >
                                        &times;
                                    </button>
                                </div>
                            ))}
                            {feeds.length === 0 && <div class="py-2 text-[0.8125rem] text-[#555]">No feeds configured.</div>}
                        </div>

                        {/* Add Feed Form */}
                        <div class="border-t border-[rgba(255,255,255,0.08)] pt-3">
                            <h3 class="mb-2 text-[0.8125rem] font-semibold text-[#aaa]">Add Feed</h3>
                            <input id="feed-name-input" type="text" placeholder="Feed name" class={`${inputClass} mb-1.5 box-border bg-[color-mix(in_srgb,var(--card)_92%,var(--muted))] text-[0.8125rem]`} />
                            <input id="feed-url-input" type="text" placeholder="RSSHub URL" class={`${inputClass} mb-2 box-border bg-[color-mix(in_srgb,var(--card)_92%,var(--muted))] text-[0.8125rem]`} />
                            <button id="feed-add-btn" class={`${primaryButtonClass} w-full border-0 text-[0.8125rem]`}>
                                + Add Feed
                            </button>
                        </div>
                    </div>
                </div>

                <div class="routes-bottom-nav">
                    <button id="mobile-search-toggle" class="routes-mobile-icon-btn routes-search-toggle" type="button">
                        Search
                    </button>
                    <div id="mobile-route-count">{totalRoutes} routes</div>
                    <button id="mobile-scroll-top" class="routes-mobile-icon-btn" type="button">
                        Top
                    </button>
                </div>

                <script
                    dangerouslySetInnerHTML={{
                        __html: `
(function () {
  var consoleRoot = document.querySelector('.routes-console');
  if (!consoleRoot) {
    return;
  }

  var sidebarToggle = document.getElementById('mobile-sidebar-toggle');
  var searchToggle = document.getElementById('mobile-search-toggle');
  var scrollTopBtn = document.getElementById('mobile-scroll-top');
  var sidebarBackdrop = document.getElementById('routes-sidebar-backdrop');
  var mobileCount = document.getElementById('mobile-route-count');
  var routeCount = document.getElementById('route-count');
  var routeCards = document.querySelectorAll('.route-card');
  var mobileMedia = window.matchMedia('(max-width: 768px)');

  function syncMobileCount() {
    if (mobileCount && routeCount) {
      mobileCount.textContent = routeCount.textContent;
    }
  }

  function setSidebarOpen(open) {
    consoleRoot.setAttribute('data-sidebar-open', open ? 'true' : 'false');
  }

  function setSearchOpen(open) {
    consoleRoot.setAttribute('data-search-open', open ? 'true' : 'false');
  }

  function resetDesktopState() {
    if (!mobileMedia.matches) {
      setSidebarOpen(false);
      setSearchOpen(true);
      routeCards.forEach(function (card) {
        card.setAttribute('data-mobile-expanded', 'true');
        var toggle = card.querySelector('.route-card-toggle');
        if (toggle) {
          toggle.textContent = '−';
        }
      });
      return;
    }

    setSearchOpen(false);
    routeCards.forEach(function (card, index) {
      var expanded = index === 0 ? 'true' : 'false';
      card.setAttribute('data-mobile-expanded', expanded);
      var toggle = card.querySelector('.route-card-toggle');
      if (toggle) {
        toggle.textContent = expanded === 'true' ? '−' : '+';
      }
    });
  }

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', function () {
      setSidebarOpen(consoleRoot.getAttribute('data-sidebar-open') !== 'true');
    });
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', function () {
      setSidebarOpen(false);
    });
  }

  if (searchToggle) {
    searchToggle.addEventListener('click', function () {
      setSearchOpen(consoleRoot.getAttribute('data-search-open') !== 'true');
      if (consoleRoot.getAttribute('data-search-open') === 'true') {
        var searchInput = document.getElementById('search-input');
        if (searchInput) {
          window.setTimeout(function () {
            searchInput.focus();
          }, 140);
        }
      }
    });
  }

  if (scrollTopBtn) {
    scrollTopBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  routeCards.forEach(function (card) {
    var trigger = card.querySelector('.route-mobile-summary');
    if (!trigger) {
      return;
    }
    trigger.addEventListener('click', function () {
      if (!mobileMedia.matches) {
        return;
      }
      var expanded = card.getAttribute('data-mobile-expanded') === 'true';
      card.setAttribute('data-mobile-expanded', expanded ? 'false' : 'true');
      var toggle = card.querySelector('.route-card-toggle');
      if (toggle) {
        toggle.textContent = expanded ? '+' : '−';
      }
    });
  });

  if (routeCount && typeof MutationObserver !== 'undefined') {
    new MutationObserver(syncMobileCount).observe(routeCount, { childList: true, subtree: true, characterData: true });
  }

  if (typeof mobileMedia.addEventListener === 'function') {
    mobileMedia.addEventListener('change', resetDesktopState);
  } else if (typeof mobileMedia.addListener === 'function') {
    mobileMedia.addListener(resetDesktopState);
  }

  syncMobileCount();
  resetDesktopState();
})();
`,
                    }}
                />

                {/* Inline JavaScript */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
(function () {
  var routes = /** @type {Array} */ (${routesJsonEscaped});
  var feeds = /** @type {Array} */ (${feedsJsonEscaped});
  var cards = document.querySelectorAll('.route-card');
  var searchInput = document.getElementById('search-input');
  var importInput = document.getElementById('import-input');
  var importBtn = document.getElementById('import-btn');
  var clearBtn = document.getElementById('clear-filter');
  var noResults = document.getElementById('no-results');
  var routeCount = document.getElementById('route-count');

  function filterCards(query) {
    var q = (query || '').toLowerCase().trim();
    var visible = 0;
    cards.forEach(function (card) {
      if (!q || card.getAttribute('data-text').indexOf(q) !== -1) {
        card.style.display = '';
        visible++;
      } else {
        card.style.display = 'none';
      }
    });
    noResults.style.display = visible === 0 ? '' : 'none';
    if (routeCount) {
      routeCount.textContent = visible + ' / ' + routes.length + ' routes';
    }
  }

  searchInput.addEventListener('input', function () {
    filterCards(this.value);
  });

  clearBtn.addEventListener('click', function () {
    searchInput.value = '';
    importInput.value = '';
    filterCards('');
    cards.forEach(function (c) {
      c.style.borderColor = 'rgba(255,255,255,0.08)';
      c.style.backgroundColor = 'rgba(255,255,255,0.02)';
    });
    if (routeCount) {
      routeCount.textContent = routes.length + ' routes';
    }
  });

  importBtn.addEventListener('click', function () {
    var raw = importInput.value.trim();
    if (!raw) return;
    var pathname;
    try {
      pathname = new URL(raw).pathname;
    } catch (e) {
      pathname = raw.startsWith('/') ? raw : '/' + raw;
    }
    var lower = pathname.toLowerCase();
    cards.forEach(function (c) { c.style.display = 'none'; });
    var matched = 0;
    cards.forEach(function (c) {
      var dataPath = c.getAttribute('data-path');
      if (dataPath && lower.startsWith(dataPath.split(':')[0] || dataPath)) {
        c.style.display = '';
        c.style.borderColor = 'color-mix(in srgb, var(--jis-accent) 50%, transparent)';
        c.style.backgroundColor = 'color-mix(in srgb, var(--jis-accent) 6%, transparent)';
        matched++;
      } else {
        c.style.borderColor = 'rgba(255,255,255,0.08)';
        c.style.backgroundColor = 'rgba(255,255,255,0.02)';
      }
    });
    noResults.style.display = matched === 0 ? '' : 'none';
    if (routeCount) {
      routeCount.textContent = matched + ' / ' + routes.length + ' routes';
    }
    searchInput.value = '';
  });

  // Translate buttons
  document.querySelectorAll('.translate-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var el = btn;
      var enSpan = el.parentElement.querySelector('.route-name-en');
      if (enSpan.style.display !== 'none' && enSpan.textContent) {
        enSpan.style.display = 'none';
        el.textContent = 'EN';
        return;
      }
      var text = el.getAttribute('data-text');
      el.textContent = '...';
      fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=' + encodeURIComponent(text))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var translated = (data[0] && data[0][0] && data[0][0][0]) || text;
          enSpan.textContent = translated;
          enSpan.style.display = '';
          el.textContent = 'ZH';
        })
        .catch(function () {
          el.textContent = 'EN';
        });
    });
  });

  // Feed toggles (client-side state only)
  document.querySelectorAll('.feed-toggle').forEach(function (toggle) {
    toggle.addEventListener('change', function () {
      var idx = parseInt(this.getAttribute('data-index'), 10);
      if (feeds[idx]) {
        feeds[idx].enabled = this.checked;
      }
      var label = this.parentElement.querySelector('span');
      if (label) label.textContent = this.checked ? 'ON' : 'OFF';
    });
  });

  // Feed remove buttons
  document.querySelectorAll('.feed-remove-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.feed-item');
      if (item) {
        var idx = parseInt(btn.getAttribute('data-index'), 10);
        feeds.splice(idx, 1);
        item.remove();
        // Re-index
        document.querySelectorAll('.feed-item').forEach(function (el, i) {
          el.setAttribute('data-index', String(i));
          var t = el.querySelector('.feed-toggle');
          if (t) t.setAttribute('data-index', String(i));
          var r = el.querySelector('.feed-remove-btn');
          if (r) r.setAttribute('data-index', String(i));
        });
      }
    });
  });

  // Feed add button
  document.getElementById('feed-add-btn').addEventListener('click', function () {
    var nameInput = document.getElementById('feed-name-input');
    var urlInput = document.getElementById('feed-url-input');
    var name = nameInput.value.trim();
    var url = urlInput.value.trim();
    if (!name || !url) return;
    feeds.push({ name: name, url: url, enabled: true });
    var idx = feeds.length - 1;
    var feedList = document.getElementById('feed-list');
    var div = document.createElement('div');
    div.className = 'feed-item';
    div.setAttribute('data-index', String(idx));
    div.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:0.5rem;padding:0.5rem 0;border-bottom:1px solid color-mix(in srgb, var(--foreground) 8%, transparent)';
    div.innerHTML =
      '<div style="min-width:0;flex:1 1 auto">' +
        '<div style="font-size:0.8125rem;font-weight:500;color:var(--jis-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(name) + '</div>' +
        '<div style="font-size:0.6875rem;color:var(--muted-foreground);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace">' + escHtml(url) + '</div>' +
      '</div>' +
      '<label style="display:flex;align-items:center;gap:0.25rem;cursor:pointer;flex-shrink:0">' +
        '<input type="checkbox" class="feed-toggle" data-index="' + idx + '" checked style="accent-color:var(--jis-accent)" />' +
        '<span style="font-size:0.625rem;color:var(--muted-foreground)">ON</span>' +
      '</label>' +
      '<button class="feed-remove-btn" data-index="' + idx + '" style="background:none;border:none;color:var(--jis-red);cursor:pointer;font-size:0.75rem;padding:0.1rem 0.3rem;font-family:monospace">&times;</button>';
    feedList.appendChild(div);

    // Wire up new toggle
    div.querySelector('.feed-toggle').addEventListener('change', function () {
      var i = parseInt(this.getAttribute('data-index'), 10);
      if (feeds[i]) feeds[i].enabled = this.checked;
      var s = this.parentElement.querySelector('span');
      if (s) s.textContent = this.checked ? 'ON' : 'OFF';
    });
    // Wire up new remove
    div.querySelector('.feed-remove-btn').addEventListener('click', function () {
      var item = this.closest('.feed-item');
      if (item) {
        var i = parseInt(this.getAttribute('data-index'), 10);
        feeds.splice(i, 1);
        item.remove();
        document.querySelectorAll('.feed-item').forEach(function (el, ii) {
          el.setAttribute('data-index', String(ii));
          var t = el.querySelector('.feed-toggle');
          if (t) t.setAttribute('data-index', String(ii));
          var r = el.querySelector('.feed-remove-btn');
          if (r) r.setAttribute('data-index', String(ii));
        });
      }
    });

    nameInput.value = '';
    urlInput.value = '';
  });

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Initial check for empty state
  if (routes.length === 0) {
    noResults.style.display = '';
    noResults.textContent = 'No routes registered.';
  }
})();
`,
                    }}
                />
            </div>
        </Layout>
    );
};

export default RoutesView;
