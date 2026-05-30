/**
 * PR-13-Login — Measures the end-to-end time from login form submission
 * to the admin tenants page fully loading.
 *
 * Flow per VU iteration:
 *   1. GET /auth/login — capture Rails CSRF token
 *   2. POST credentials — follow redirects
 *   3. GET /admin/resources/tenants (if not already redirected there)
 *   4. Record total elapsed time as `login_to_tenants_duration`
 *
 * Credentials are read from environment variables:
 *   PERF_ADMIN_EMAIL    (defaults to admin.example.com)
 *   PERF_ADMIN_PASSWORD
 *
 * Usage:
 *   k6 run pr13-login-to-tenants.js \
 *     -e BASE_URL=http://admin.lvh.me:3000 \
 *     -e PERF_ADMIN_EMAIL=admin.example.com \
 *     -e PERF_ADMIN_PASSWORD=SecurePassword123!
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const loginToTenantsDuration = new Trend('login_to_tenants_duration', true);
const loginErrors = new Counter('login_errors');

const BASE_URL = (__ENV.BASE_URL || 'http://admin.lvh.me:3000').replace(/\/$/, '');
const EMAIL = __ENV.PERF_ADMIN_EMAIL || 'admin.example.com';
const PASSWORD = __ENV.PERF_ADMIN_PASSWORD || '';

const LOGIN_PATH = '/auth/login';
const TENANTS_PATH = '/admin/resources/tenants';

export const options = {
    scenarios: {
        login_to_tenants: {
            executor: 'constant-vus',
            vus: 5,
            duration: '2m',
        },
    },
    thresholds: {
        // 95% of login→tenants flows must complete within 10 seconds
        login_to_tenants_duration: ['p(95)<10000'],
        login_errors: ['count<5'],
    },
    tags: { requirement: 'PR-13-Login' },
};

export default function () {
    // ── Step 1: GET login page → extract Rails CSRF authenticity_token ────────
    const loginPageRes = http.get(`${BASE_URL}${LOGIN_PATH}`, {
        redirects: 5,
        tags: { name: 'login_page_get' },
    });

    // Match both attribute orderings Rails may emit
    const csrfMatch = loginPageRes.body
        ? loginPageRes.body.match(
            /name="authenticity_token"[^>]*value="([^"]+)"|value="([^"]+)"[^>]*name="authenticity_token"/
        )
        : null;
    const csrf = csrfMatch ? (csrfMatch[1] || csrfMatch[2] || '') : '';

    if (!csrf) {
        console.warn('CSRF token not found — POST may be rejected with 422');
    }

    // ── Step 2: POST credentials — follow all redirects ───────────────────────
    const t0 = Date.now();

    const loginRes = http.post(
        `${BASE_URL}${LOGIN_PATH}`,
        {
            authenticity_token: csrf,
            'user[email]': EMAIL,
            'user[password]': PASSWORD,
        },
        {
            redirects: 10,
            tags: { name: 'login_post' },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Referer: `${BASE_URL}${LOGIN_PATH}`,
            },
        }
    );

    // ── Step 3: Navigate to tenants page if not already there ─────────────────
    let tenantsRes = loginRes;
    if (!loginRes.url.includes(TENANTS_PATH)) {
        tenantsRes = http.get(`${BASE_URL}${TENANTS_PATH}`, {
            redirects: 5,
            tags: { name: 'tenants_page_get' },
        });
    }

    const elapsed = Date.now() - t0;

    // ── Step 4: Validate and record ───────────────────────────────────────────
    const ok = check(tenantsRes, {
        'reached tenants page': (r) => r.url.includes(TENANTS_PATH),
        'status 200': (r) => r.status === 200,
        'not redirected to login': (r) => !r.url.includes(LOGIN_PATH),
    });

    if (ok) {
        loginToTenantsDuration.add(elapsed);
    } else {
        loginErrors.add(1);
        console.error(
            `Login failed — status: ${loginRes.status}, final URL: ${tenantsRes.url}`
        );
    }

    sleep(2);
}
