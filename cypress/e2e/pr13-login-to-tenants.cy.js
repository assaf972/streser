// perf/cypress/e2e/pr13-login-to-tenants.cy.js
//
// PR-13-Login: Measures the time from login form submission to the
// admin tenants page fully loading.
//
// Flow per iteration:
//   1. Clear all cookies/storage (clean session)
//   2. Visit /auth/login and fill credentials
//   3. Click submit; wait for /admin/resources/tenants
//   4. Record elapsed time; assert p95 ≤ threshold
//
// Credentials come from Cypress env vars (set via strester.json or CLI):
//   PERF_ADMIN_EMAIL    (default: admin.example.com)
//   PERF_ADMIN_PASSWORD
//
// Usage:
//   CYPRESS_PERF_ADMIN_PASSWORD=SecurePassword123! npx cypress run \
//     --spec e2e/pr13-login-to-tenants.cy.js

const RUNS = 3;
const THRESHOLD_MS = 10_000;
const LOGIN_PATH = '/auth/login';
const TENANTS_PATH = '/admin/resources/tenants';

describe('PR-13-Login: Login → Admin Tenants Page', () => {
    it(`login and reach tenants page within ${THRESHOLD_MS}ms (p95)`, () => {
        const email = Cypress.env('PERF_ADMIN_EMAIL') || 'admin.example.com';
        const password = Cypress.env('PERF_ADMIN_PASSWORD') || '';
        const durations = [];
        let t0;

        Cypress._.times(RUNS, (i) => {
            // ── Clean session before each iteration ─────────────────────────
            cy.clearAllCookies();
            cy.clearAllLocalStorage();
            cy.clearAllSessionStorage();

            // ── Visit login page ─────────────────────────────────────────────
            cy.visit(LOGIN_PATH);

            // ── Fill credentials ─────────────────────────────────────────────
            // Supports common field patterns (Devise, Administrate, custom)
            cy.get([
                'input[name="email"]',
                'input[type="email"]',
                'input[name="user[email]"]',
                'input[name="username"]',
                'input[id*="email"]',
            ].join(', ')).first().type(email);

            cy.get('input[type="password"]').type(password, { log: false });

            // ── Submit and measure ───────────────────────────────────────────
            cy.then(() => { t0 = Date.now(); });

            cy.get('button[type="submit"], input[type="submit"]').first().click();

            cy.url({ timeout: 30_000 }).should('include', TENANTS_PATH);

            cy.then(() => {
                const elapsed = Date.now() - t0;
                durations.push(elapsed);
                cy.log(`Run ${i + 1}: click→tenants = ${elapsed}ms`);
            });

            // Also log Navigation Timing from the tenants page
            cy.window().then((win) => {
                const [nav] = win.performance.getEntriesByType('navigation');
                if (nav) {
                    const loadTime = Math.round(nav.loadEventEnd - nav.startTime);
                    const domReady = Math.round(nav.domContentLoadedEventEnd - nav.startTime);
                    const ttfb = Math.round(nav.responseStart - nav.startTime);
                    cy.log(
                        `  tenants loadTime=${loadTime}ms  domReady=${domReady}ms  ttfb=${ttfb}ms`
                    );
                }
            });
        });

        // ── p95 assertion ─────────────────────────────────────────────────────
        cy.then(() => {
            durations.sort((a, b) => a - b);
            const p95idx = Math.ceil(durations.length * 0.95) - 1;
            const p95 = durations[Math.max(p95idx, 0)];

            cy.log(
                `PR-13 summary: runs=${RUNS}  ` +
                `min=${durations[0]}ms  max=${durations[durations.length - 1]}ms  p95=${p95}ms`
            );

            expect(
                p95,
                `p95 login→tenants time (${p95}ms) exceeded threshold of ${THRESHOLD_MS}ms`,
            ).to.be.lessThan(THRESHOLD_MS);
        });
    });
});
