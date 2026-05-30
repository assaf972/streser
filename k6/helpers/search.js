import http from 'k6/http';
import { authUrl } from './auth.js';

/**
 * Global text search for compounds.
 * Endpoint: GET /api/v1/global_search?term=...&model=Chemistry::Compound
 */
export function globalSearch(term) {
    return http.get(authUrl(`/api/v1/global_search?term=${encodeURIComponent(term)}&model=Chemistry::Compound`));
}

/**
 * Compound index with text filter (compound name).
 */
export function filterByName(name, page = 1, perPage = 20) {
    return http.get(authUrl(`/api/v1/compounds?page=${page}&per_page=${perPage}&name=${encodeURIComponent(name)}`));
}

/**
 * Compound index with SysID / external ID filter.
 */
export function filterBySysId(sysId, page = 1, perPage = 20) {
    return http.get(authUrl(`/api/v1/compounds?page=${page}&per_page=${perPage}&sys_id=${encodeURIComponent(sysId)}`));
}

/**
 * Compound index with numeric-range property filter (MW range).
 */
export function filterByMwRange(minMw, maxMw, page = 1, perPage = 20) {
    return http.get(authUrl(`/api/v1/compounds?page=${page}&per_page=${perPage}&mw_min=${minMw}&mw_max=${maxMw}`));
}

/**
 * Compound index with cLogP range filter.
 */
export function filterByClogpRange(minClogp, maxClogp, page = 1, perPage = 20) {
    return http.get(authUrl(`/api/v1/compounds?page=${page}&per_page=${perPage}&clogp_min=${minClogp}&clogp_max=${maxClogp}`));
}

/**
 * Compound index with boolean filter (Lipinski).
 */
export function filterByLipinski(value, page = 1, perPage = 20) {
    return http.get(authUrl(`/api/v1/compounds?page=${page}&per_page=${perPage}&lipinski=${value}`));
}

/**
 * Compound index with custom-field filter.
 */
export function filterByCustomField(fieldName, fieldValue, page = 1, perPage = 20) {
    return http.get(authUrl(`/api/v1/compounds?page=${page}&per_page=${perPage}&custom_fields[${encodeURIComponent(fieldName)}]=${encodeURIComponent(fieldValue)}`));
}

/**
 * Compound index with parent-structure linkage filter.
 */
export function filterByParent(parentId, page = 1, perPage = 20) {
    return http.get(authUrl(`/api/v1/compounds?page=${page}&per_page=${perPage}&parent_id=${parentId}`));
}

/**
 * Compound index sorted by a specific column.
 */
export function sortedIndex(sortBy, sortDir = 'asc', page = 1, perPage = 20) {
    return http.get(authUrl(`/api/v1/compounds?page=${page}&per_page=${perPage}&sort=${sortBy}&sort_dir=${sortDir}`));
}

/**
 * Compound index with combined filter + sort.
 */
export function filteredSortedIndex(filterParams, sortBy, sortDir = 'asc', page = 1, perPage = 20) {
    return http.get(authUrl(`/api/v1/compounds?page=${page}&per_page=${perPage}&${filterParams}&sort=${sortBy}&sort_dir=${sortDir}`));
}
