/**
 * PR-0-BaseURL — Measures HTTP response time for the base URL (home page).
 *
 * Usage:
 *   k6 run pr0-base-url-load.js -e BASE_URL=https://localhost:3000 -e TOKEN=...
 */
import http from 'k6/http';
import { Trend, Counter } from 'k6/metrics';
import { check, sleep } from 'k6';
import { authUrl } from '../helpers/auth.js';

const pageLoadDuration = new Trend('base_url_load_duration', true);
const pageLoadErrors = new Counter('base_url_load_errors');

export const options = {
    scenarios: {
        base_url_load: {
            executor: 'constant-vus',
            vus: 10,
            duration: '1m',
        },
    },
    thresholds: {
        base_url_load_duration: ['p(95)<3000'],
        base_url_load_errors: ['count<5'],
    },
    tags: { requirement: 'PR-0-BaseURL' },
};

export default function () {
    const url = authUrl('/');

    const res = http.get(url, { tags: { name: 'base_url' } });

    const ok = check(res, {
        'status is 200 or 302': (r) => r.status === 200 || r.status === 302,
    });

    pageLoadDuration.add(res.timings.duration);

    if (!ok) {
        pageLoadErrors.add(1);
        console.error(`Unexpected status ${res.status} for ${url}`);
    }

    sleep(1);
}
