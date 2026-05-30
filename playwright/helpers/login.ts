import { type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const EMAIL = process.env.PERF_EMAIL || 'perf-user@labguru.com';
const PASSWORD = process.env.PERF_PASSWORD || '';

/**
 * Log in via the browser UI. Stores session cookies for subsequent requests.
 * If PERF_TOKEN is set, uses token-based direct navigation instead.
 */
export async function login(page: Page): Promise<void> {
    const token = process.env.PERF_TOKEN;

    if (token) {
        await page.goto(`${BASE_URL}?token=${token}`);
        await page.waitForLoadState('networkidle');
        return;
    }

    await page.goto(`${BASE_URL}/users/sign_in`);
    await page.fill('input[name="user[email]"]', EMAIL);
    await page.fill('input[name="user[password]"]', PASSWORD);
    await page.click('input[type="submit"], button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15_000 });
}

/**
 * Navigate to a path with token auth appended.
 */
export async function navigateWithAuth(page: Page, path: string): Promise<void> {
    const token = process.env.PERF_TOKEN;
    const separator = path.includes('?') ? '&' : '?';
    const url = token
        ? `${BASE_URL}${path}${separator}token=${token}`
        : `${BASE_URL}${path}`;
    await page.goto(url);
}
