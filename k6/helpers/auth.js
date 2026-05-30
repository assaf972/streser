/**
 * k6 authentication helper for Labguru API.
 * Labguru uses query-parameter token auth: ?token=<API_TOKEN>
 */

const TOKEN = __ENV.TOKEN || __ENV.PERF_TOKEN_A;
const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

export function authUrl(path) {
    const separator = path.includes('?') ? '&' : '?';
    return `${BASE_URL}${path}${separator}token=${TOKEN}`;
}

export function authUrlForUser(path, token) {
    const separator = path.includes('?') ? '&' : '?';
    return `${BASE_URL}${path}${separator}token=${token}`;
}

export function getBaseUrl() {
    return BASE_URL;
}

export function getToken() {
    return TOKEN;
}

export function getTokenB() {
    return __ENV.PERF_TOKEN_B || __ENV.TOKEN_B;
}

export const jsonHeaders = {
    headers: { 'Content-Type': 'application/json' },
};
