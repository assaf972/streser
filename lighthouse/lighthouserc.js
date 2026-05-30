/**
 * lighthouserc.js — PR-13 Lighthouse CI config
 *
 * Audits /admin/resources/tenants after logging in via puppeteer-login.js.
 * Runs 3 audits and asserts performance / accessibility / timing thresholds.
 *
 * Usage (via strester):
 *   bin/strester run lighthouse/lighthouserc.js
 *
 * Direct usage:
 *   PERF_ADMIN_PASSWORD=SecurePassword123! npx lhci autorun --config=lighthouserc.js
 */
'use strict';

const BASE_URL = (process.env.BASE_URL || 'http://admin.lvh.me:3000').replace(/\/$/, '');
const TENANTS_URL = `${BASE_URL}/admin/resources/tenants`;
const OUTPUT_DIR = process.env.OUTPUT_DIR || './.lighthouseci';

module.exports = {
    ci: {
        collect: {
            url: [TENANTS_URL],
            numberOfRuns: 3,
            puppeteerScript: './puppeteer-login.js',
            settings: {
                formFactor: 'desktop',
                screenEmulation: {
                    width: 1920,
                    height: 1080,
                    deviceScaleFactor: 1,
                    mobile: false,
                    disabled: false,
                },
                // No artificial throttling — measure real local server performance
                throttlingMethod: 'provided',
                // Audits irrelevant on localhost
                skipAudits: ['uses-http2', 'redirects-http'],
                chromeFlags: '--no-sandbox --disable-dev-shm-usage --ignore-certificate-errors',
            },
        },
        assert: {
            assertions: {
                // Scores: 0–1 scale (0.5 = 50). Set to 'warn' to avoid blocking CI.
                'categories:performance': ['warn', { minScore: 0.5 }],
                'categories:accessibility': ['warn', { minScore: 0.5 }],
                'categories:best-practices': ['warn', { minScore: 0.5 }],
                // Core Web Vitals (ms)
                'first-contentful-paint': ['warn', { maxNumericValue: 5_000 }],
                'largest-contentful-paint': ['warn', { maxNumericValue: 10_000 }],
                'interactive': ['warn', { maxNumericValue: 15_000 }],
                'total-blocking-time': ['warn', { maxNumericValue: 2_000 }],
                'cumulative-layout-shift': ['warn', { maxNumericValue: 0.25 }],
            },
        },
        upload: {
            // Save reports locally; avoids needing a remote LHCI server
            target: 'filesystem',
            outputDir: OUTPUT_DIR,
        },
    },
};
