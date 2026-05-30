import http from 'k6/http';
import { authUrl, jsonHeaders } from './auth.js';

/**
 * Create a compound via POST /api/v1/compounds.
 * Returns the full k6 response object.
 */
export function createCompound(smiles, extraFields = {}) {
    const payload = JSON.stringify({
        compound: { smiles, ...extraFields },
    });
    return http.post(authUrl('/api/v1/compounds'), payload, jsonHeaders);
}

/**
 * Create a compound via POST /api/v2/compounds.
 */
export function createCompoundV2(smiles, extraFields = {}) {
    const payload = JSON.stringify({
        compound: { smiles, ...extraFields },
    });
    return http.post(authUrl('/api/v2/compounds'), payload, jsonHeaders);
}

/**
 * Update a compound via PUT /api/v1/compounds/:id.
 */
export function updateCompound(id, fields) {
    const payload = JSON.stringify({ compound: fields });
    return http.put(authUrl(`/api/v1/compounds/${id}`), payload, jsonHeaders);
}

/**
 * Fetch a single compound by ID via GET /api/v1/compounds/:id.
 */
export function getCompound(id) {
    return http.get(authUrl(`/api/v1/compounds/${id}`));
}

/**
 * List compounds with pagination via GET /api/v1/compounds.
 */
export function listCompounds(page = 1, perPage = 20, extraParams = '') {
    const params = `page=${page}&per_page=${perPage}${extraParams ? '&' + extraParams : ''}`;
    return http.get(authUrl(`/api/v1/compounds?${params}`));
}

/**
 * Delete a compound via DELETE /api/v1/compounds/:id.
 */
export function deleteCompound(id) {
    return http.del(authUrl(`/api/v1/compounds/${id}`));
}

/**
 * Batch-create compounds in setup(). Returns array of compound IDs.
 */
export function batchCreateCompounds(smilesList) {
    const ids = [];
    for (const smiles of smilesList) {
        const res = createCompound(smiles);
        if (res.status === 201) {
            const body = res.json();
            ids.push(body.id);
        }
    }
    return ids;
}
