import { check } from 'k6';

/**
 * Standard check: HTTP 201 Created with compound ID in response.
 */
export function checkCreated(res, label = 'compound') {
    return check(res, {
        [`${label}: HTTP 201`]: (r) => r.status === 201,
        [`${label}: has id`]: (r) => {
            const body = r.json();
            return body && body.id !== undefined;
        },
    });
}

/**
 * Standard check: HTTP 200 OK.
 */
export function checkOk(res, label = 'request') {
    return check(res, {
        [`${label}: HTTP 200`]: (r) => r.status === 200,
    });
}

/**
 * Standard check: HTTP 202 Accepted with bulk_run_id.
 */
export function checkAccepted(res, label = 'bulk') {
    return check(res, {
        [`${label}: HTTP 202`]: (r) => r.status === 202,
        [`${label}: has bulk_run_id`]: (r) => {
            const body = r.json();
            return body && body.bulk_run_id !== undefined;
        },
    });
}

/**
 * Standard check: HTTP 422 Unprocessable Entity.
 */
export function checkValidationError(res, label = 'validation') {
    return check(res, {
        [`${label}: HTTP 422`]: (r) => r.status === 422,
        [`${label}: has error message`]: (r) => {
            const body = r.json();
            return body && (body.error || body.errors);
        },
    });
}

/**
 * Standard check: HTTP 404 Not Found (used after delete).
 */
export function checkNotFound(res, label = 'deleted') {
    return check(res, {
        [`${label}: HTTP 404`]: (r) => r.status === 404,
    });
}

/**
 * Check response time is within threshold.
 */
export function checkLatency(res, thresholdMs, label = 'latency') {
    return check(res, {
        [`${label}: < ${thresholdMs}ms`]: (r) => r.timings.duration < thresholdMs,
    });
}

/**
 * Check bulk completion — no operations lost.
 */
export function checkBulkReconciliation(result, label = 'bulk reconciliation') {
    return check(null, {
        [`${label}: succeeded + failed == total`]: () =>
            result.succeeded + result.failed === result.total,
        [`${label}: no timeout`]: () => result.finalStatus !== 'timeout',
    });
}
