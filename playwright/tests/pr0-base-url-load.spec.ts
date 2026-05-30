/**
 * PR-0-BaseURL-UI — Measures browser page load time for the base URL.
 *
 * Uses the Navigation Timing API to capture real browser load metrics:
 *   - domContentLoadedEventEnd (DOM ready)
 *   - loadEventEnd (full page load including all resources)
 *
 * Run:
 *   BASE_URL=https://localhost:3000 npx playwright test pr0-base-url-load.spec.ts
 */
import { test, expect } from '@playwright/test';
import { login } from '../helpers/login';

const RUNS = 5;
const LOAD_THRESHOLD_MS = 5000;

test.describe('PR-0-BaseURL-UI', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test(`base URL loads within ${LOAD_THRESHOLD_MS}ms (p95)`, async ({ page }) => {
        const loadTimes: number[] = [];
        const domReadyTimes: number[] = [];

        for (let i = 0; i < RUNS; i++) {
            await page.goto('/');
            await page.waitForLoadState('load');

            const timings = await page.evaluate(() => {
                const [nav] = performance.getEntriesByType(
                    'navigation',
                ) as PerformanceNavigationTiming[];
                return {
                    loadTime: nav ? nav.loadEventEnd - nav.startTime : -1,
                    domReady: nav ? nav.domContentLoadedEventEnd - nav.startTime : -1,
                    ttfb: nav ? nav.responseStart - nav.startTime : -1,
                };
            });

            if (timings.loadTime >= 0) {
                loadTimes.push(timings.loadTime);
                domReadyTimes.push(timings.domReady);
                console.log(
                    `Run ${i + 1}: loadTime=${Math.round(timings.loadTime)}ms, ` +
                    `domReady=${Math.round(timings.domReady)}ms, ` +
                    `ttfb=${Math.round(timings.ttfb)}ms`,
                );
            }
        }

        loadTimes.sort((a, b) => a - b);
        domReadyTimes.sort((a, b) => a - b);

        const p95Load = loadTimes[Math.ceil(loadTimes.length * 0.95) - 1];
        const p95Dom = domReadyTimes[Math.ceil(domReadyTimes.length * 0.95) - 1];

        console.log(`PR-0-BaseURL-UI: p95 loadTime=${Math.round(p95Load)}ms, p95 domReady=${Math.round(p95Dom)}ms`);

        expect(p95Load, `p95 page load time exceeded ${LOAD_THRESHOLD_MS}ms`).toBeLessThanOrEqual(
            LOAD_THRESHOLD_MS,
        );
    });
});
