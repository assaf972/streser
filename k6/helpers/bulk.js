import http from 'k6/http';
import { sleep } from 'k6';
import { authUrl, jsonHeaders } from './auth.js';

/**
 * Submit a bulk operation via POST /api/v1/compounds/bulk.
 * Returns { response, bulkRunId, statusUrl }.
 */
export function submitBulk(operations) {
    const payload = JSON.stringify({ operations });
    const res = http.post(authUrl('/api/v1/compounds/bulk'), payload, jsonHeaders);
    let bulkRunId = null;
    let statusUrl = null;

    if (res.status === 202) {
        const body = res.json();
        bulkRunId = body.bulk_run_id;
        statusUrl = body.status_url;
    }

    return { response: res, bulkRunId, statusUrl };
}

/**
 * Poll the bulk status URL until the operation reaches a terminal state.
 * Returns { finalStatus, elapsed, succeeded, failed, total }.
 */
export function pollBulkCompletion(bulkRunId, pollIntervalSec = 5, timeoutMs = 1800000) {
    const startTime = Date.now();
    const deadline = startTime + timeoutMs;

    while (Date.now() < deadline) {
        const res = http.get(authUrl(`/api/v1/bulk/${bulkRunId}`));
        if (res.status === 200) {
            const body = res.json();
            const status = body.status;

            if (status === 'completed' || status === 'failed' || status === 'partial') {
                return {
                    finalStatus: status,
                    elapsed: Date.now() - startTime,
                    succeeded: body.succeeded || 0,
                    failed: body.failed || 0,
                    total: body.total_operations || 0,
                    successfulResults: body.successful_results || [],
                    failedResults: body.failed_results || [],
                };
            }
        }
        sleep(pollIntervalSec);
    }

    return {
        finalStatus: 'timeout',
        elapsed: Date.now() - startTime,
        succeeded: 0,
        failed: 0,
        total: 0,
    };
}

/**
 * Build a create operation for the bulk API.
 */
export function buildCreateOp(smiles, operationId, extraFields = {}) {
    return {
        operation_id: operationId,
        action: 'create',
        data: { smiles, ...extraFields },
    };
}

/**
 * Build an update operation for the bulk API.
 */
export function buildUpdateOp(compoundId, operationId, fields = {}) {
    return {
        operation_id: operationId,
        action: 'update',
        item_id: compoundId,
        data: fields,
    };
}
