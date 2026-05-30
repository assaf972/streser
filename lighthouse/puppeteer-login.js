/**
 * puppeteer-login.js — Shared LHCI authentication script
 *
 * LHCI calls this before each Lighthouse audit run. It opens a page,
 * performs the admin login, and closes the page — LHCI then carries
 * the resulting session cookies into the actual audit.
 *
 * Env vars (set via strester or shell):
 *   BASE_URL            (default: http://admin.lvh.me:3000)
 *   PERF_ADMIN_EMAIL    (default: admin.example.com)
 *   PERF_ADMIN_PASSWORD
 */
'use strict';

module.exports = async (browser, _context) => {
    const baseUrl = (process.env.BASE_URL || 'http://admin.lvh.me:3000').replace(/\/$/, '');
    const email = process.env.PERF_ADMIN_EMAIL || 'admin.example.com';
    const password = process.env.PERF_ADMIN_PASSWORD || '';

    const page = await browser.newPage();

    try {
        await page.goto(`${baseUrl}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });

        // Fill email — try selector patterns used by Devise, Administrate, and custom forms
        const emailSelectors = [
            'input[name="email"]',
            'input[type="email"]',
            'input[name="user[email]"]',
            'input[name="username"]',
            'input[id*="email"]',
        ];
        let filled = false;
        for (const sel of emailSelectors) {
            const el = await page.$(sel);
            if (el) {
                await el.type(email, { delay: 30 });
                filled = true;
                break;
            }
        }
        if (!filled) {
            throw new Error(`No email input found on ${baseUrl}/auth/login`);
        }

        // Fill password
        await page.type('input[type="password"]', password, { delay: 30 });

        // Click submit and wait for navigation to complete
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30_000 }),
            page.click('button[type="submit"], input[type="submit"]'),
        ]);

        const finalUrl = page.url();
        if (finalUrl.includes('/auth/login') || finalUrl.includes('/sign_in')) {
            throw new Error(`Login appears to have failed — still on auth page: ${finalUrl}`);
        }

        console.log(`[lhci-auth] Login successful — session active (redirected to ${finalUrl})`);
    } catch (err) {
        console.error(`[lhci-auth] Login error: ${err.message}`);
        throw err;
    } finally {
        await page.close();
    }
};
