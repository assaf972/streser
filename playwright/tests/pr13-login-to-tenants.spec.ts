/**
 * PR-13-Login — Measures the time from login form submission to the
 * admin tenants page fully loading.
 *
 * Flow per run:
 *   1. Fresh browser context (no cookies) → navigate to /auth/login
 *   2. Fill email + password → click submit
 *   3. Wait for /admin/resources/tenants to finish loading
 *   4. Record click→load elapsed time and Navigation Timing metrics
 *
 * Credentials are read from environment variables (set in strester.json):
 *   PERF_ADMIN_EMAIL    (default: admin.example.com)
 *   PERF_ADMIN_PASSWORD
 *
 * Usage:
 *   PERF_ADMIN_PASSWORD=SecurePassword123! npx playwright test pr13-login-to-tenants.spec.ts
 */
import { test, expect, chromium } from '@playwright/test';

const BASE_URL = (process.env.BASE_URL || 'http://admin.lvh.me:3000').replace(/\/$/, '');
const EMAIL = process.env.PERF_ADMIN_EMAIL || 'admin.example.com';
const PASSWORD = process.env.PERF_ADMIN_PASSWORD || '';
const LOGIN_URL = `${BASE_URL}/auth/login`;
const TENANTS_URL = `${BASE_URL}/admin/resources/tenants`;

const RUNS = 3;
const THRESHOLD_MS = 10_000;

test.describe('PR-13-Login: Login → Admin Tenants Page', () => {
    test(`login and reach tenants page within ${THRESHOLD_MS}ms (p95)`, async ({ }) => {
        const durations: number[] = [];

        for (let i = 0; i < RUNS; i++) {
            // Fresh context per run ensures no session cookie carry-over
            const browser = await chromium.launch();
            const context = await browser.newContext({ ignoreHTTPSErrors: true });
            const page = await context.newPage();

            // ── Navigate to login page ──────────────────────────────────────
            await page.goto(LOGIN_URL);
            await page.waitForLoadState('domcontentloaded');

            // ── Fill credentials ────────────────────────────────────────────
            // Supports common field naming patterns (Devise, Administrate, custom)
            const emailInput = page.locator([
                'input[name="email"]',
                'input[type="email"]',
                'input[name="user[email]"]',
                'input[name="username"]',
                'input[id*="email"]',
            ].join(', ')).first();

            await emailInput.fill(EMAIL);
            await page.locator('input[type="password"]').fill(PASSWORD);

            // ── Submit and measure time to tenants page ─────────────────────
            const t0 = Date.now();

            await page.locator('button[type="submit"], input[type="submit"]').first().click();

            await page.waitForURL(`${TENANTS_URL}**`, { timeout: 30_000 });
            await page.waitForLoadState('load');

            const elapsed = Date.now() - t0;
            durations.push(elapsed);

            // Also capture browser Navigation Timing for the tenants page
            const timing = await page.evaluate(() => {
                const [nav] = performance.getEntriesByType(
                    'navigation',
                ) as PerformanceNavigationTiming[];
                if (!nav) return null;
                return {
                    loadTime: Math.round(nav.loadEventEnd - nav.startTime),
                    domReady: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
                    ttfb: Math.round(nav.responseStart - nav.startTime),
                };
            });

            console.log(
                `Run ${i + 1}: click→tenants=${elapsed}ms` +
                (timing
                    ? `  |  tenants loadTime=${timing.loadTime}ms` +
                    `  domReady=${timing.domReady}ms  ttfb=${timing.ttfb}ms`
                    : ''),
            );

            await context.close();
            await browser.close();
        }

        // ── p95 assertion ───────────────────────────────────────────────────
        durations.sort((a, b) => a - b);
        const p95idx = Math.ceil(durations.length * 0.95) - 1;
        const p95 = durations[Math.max(p95idx, 0)];

        console.log(
            `PR-13 summary: runs=${RUNS}  ` +
            `min=${durations[0]}ms  max=${durations[durations.length - 1]}ms  p95=${p95}ms`,
        );

        expect(
            p95,
            `p95 login→tenants time (${p95}ms) exceeded threshold of ${THRESHOLD_MS}ms`,
        ).toBeLessThanOrEqual(THRESHOLD_MS);
    });
});
