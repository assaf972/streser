// sentry_react.ts
// Sentry React SDK — captures Web Vitals for compound pages
// LCP is directly relevant to PR-7-Ready and PR-7-Load
//
// To integrate: import and call init() in your React entry point,
// then call trackKetcherReady/trackKetcherCanvasReady from the
// Ketcher component lifecycle.

import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    release: process.env.REACT_APP_GIT_SHA,
    integrations: [
        new BrowserTracing({
            routingInstrumentation: Sentry.reactRouterV6Instrumentation,
            enableLongTask: true,  // Capture Web Vitals (LCP, FID, CLS)
        }),
    ],
    tracesSampleRate: 0.3,
    tracesSampler: (ctx) => {
        const url = ctx.transactionContext?.name || '';
        // Always trace compound pages
        return url.includes('/compounds/') ? 1.0 : 0.3;
    },
});

// Custom measurement for Ketcher toolbar ready time (PR-7-Ready)
export function trackKetcherReady(startTime: number) {
    const transaction = Sentry.getActiveTransaction();
    if (transaction) {
        transaction.setMeasurement(
            'ketcher_ready_ms', Date.now() - startTime, 'millisecond'
        );
    }
}

// Custom measurement for Ketcher canvas render (PR-7-Load)
export function trackKetcherCanvasReady(startTime: number) {
    const transaction = Sentry.getActiveTransaction();
    if (transaction) {
        transaction.setMeasurement(
            'ketcher_canvas_ms', Date.now() - startTime, 'millisecond'
        );
    }
}
