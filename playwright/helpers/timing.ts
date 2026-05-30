import { type Page } from '@playwright/test';

/**
 * Measure the time between two actions using performance.now().
 * Returns elapsed time in milliseconds.
 */
export async function measureAction(
    page: Page,
    action: () => Promise<void>,
    waitFor: () => Promise<void>,
): Promise<number> {
    const start = await page.evaluate(() => performance.now());
    await action();
    await waitFor();
    const end = await page.evaluate(() => performance.now());
    return end - start;
}

/**
 * Run an action N times and return the p95 timing.
 */
export async function measureP95(
    page: Page,
    action: () => Promise<number>,
    iterations: number = 20,
): Promise<{ p95: number; median: number; timings: number[] }> {
    const timings: number[] = [];

    for (let i = 0; i < iterations; i++) {
        const elapsed = await action();
        timings.push(elapsed);
    }

    timings.sort((a, b) => a - b);
    const p95Index = Math.ceil(timings.length * 0.95) - 1;
    const medianIndex = Math.floor(timings.length / 2);

    return {
        p95: timings[p95Index],
        median: timings[medianIndex],
        timings,
    };
}

/**
 * Measure page load time from navigation start to load complete.
 */
export async function measurePageLoad(page: Page, url: string): Promise<number> {
    const start = Date.now();
    await page.goto(url, { waitUntil: 'networkidle' });
    return Date.now() - start;
}

/**
 * Assert a timing value is under a threshold, with a descriptive message.
 */
export function assertTiming(
    actual: number,
    threshold: number,
    label: string,
): { passed: boolean; message: string } {
    const passed = actual <= threshold;
    return {
        passed,
        message: `${label}: ${Math.round(actual)}ms ${passed ? '≤' : '>'} ${threshold}ms → ${passed ? 'PASS' : 'FAIL'}`,
    };
}
