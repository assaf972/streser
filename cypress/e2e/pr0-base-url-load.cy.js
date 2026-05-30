// perf/cypress/e2e/pr0-base-url-load.cy.js
// PR-0-BaseURL: Measures browser page load time for the base URL.
//
// Uses the Navigation Timing API to capture:
//   - TTFB (Time To First Byte)
//   - DOM Content Loaded
//   - Full page load (loadEventEnd)
//
// Threshold: p95 of loadEventEnd < 5000ms across RUNS iterations.

const RUNS = 5;
const LOAD_THRESHOLD_MS = 5000;

describe('PR-0-BaseURL: Base URL Page Load Time', () => {
    beforeEach(() => {
        cy.login();
    });

    it(`base URL loads within ${LOAD_THRESHOLD_MS}ms (p95)`, () => {
        const loadTimes = [];
        const domReadyTimes = [];
        const ttfbTimes = [];

        Cypress._.times(RUNS, (i) => {
            cy.visit('/');
            cy.window().then((win) => {
                const [nav] = win.performance.getEntriesByType('navigation');
                if (nav) {
                    const load = nav.loadEventEnd - nav.startTime;
                    const domReady = nav.domContentLoadedEventEnd - nav.startTime;
                    const ttfb = nav.responseStart - nav.startTime;

                    loadTimes.push(load);
                    domReadyTimes.push(domReady);
                    ttfbTimes.push(ttfb);

                    cy.log(
                        `Run ${i + 1}: ` +
                        `load=${Math.round(load)}ms  ` +
                        `domReady=${Math.round(domReady)}ms  ` +
                        `ttfb=${Math.round(ttfb)}ms`
                    );
                }
            });
        });

        cy.then(() => {
            loadTimes.sort((a, b) => a - b);
            domReadyTimes.sort((a, b) => a - b);
            ttfbTimes.sort((a, b) => a - b);

            const p95idx = Math.ceil(loadTimes.length * 0.95) - 1;
            const p95load = loadTimes[p95idx];
            const p95dom = domReadyTimes[p95idx];
            const p95ttfb = ttfbTimes[p95idx];

            cy.log(`PR-0-BaseURL p95 → load=${Math.round(p95load)}ms  domReady=${Math.round(p95dom)}ms  ttfb=${Math.round(p95ttfb)}ms`);

            expect(
                p95load,
                `p95 page load time (${Math.round(p95load)}ms) exceeded threshold of ${LOAD_THRESHOLD_MS}ms`
            ).to.be.lessThan(LOAD_THRESHOLD_MS);
        });
    });
});
