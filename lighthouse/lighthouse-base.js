/**
 * lighthouse-base.js — PR-0 direct Lighthouse config
 *
 * Audits the base URL (login/home page) with no authentication.
 * Passed to `npx lighthouse <url> --config-path=lighthouse-base.js`.
 *
 * Usage (via strester):
 *   bin/strester run lighthouse/lighthouse-base.js
 *
 * Direct usage:
 *   npx lighthouse http://admin.lvh.me:3000/auth/login \
 *     --config-path=lighthouse-base.js \
 *     --output json,html \
 *     --output-path ./lh-base-result
 */
'use strict';

module.exports = {
    extends: 'lighthouse:default',
    settings: {
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        formFactor: 'desktop',
        screenEmulation: {
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1,
            mobile: false,
            disabled: false,
        },
        // No artificial throttling — measure the real server on localhost
        throttlingMethod: 'provided',
        skipAudits: ['uses-http2', 'redirects-http', 'canonical'],
        chromeFlags: '--no-sandbox --disable-dev-shm-usage --ignore-certificate-errors',
    },
};
