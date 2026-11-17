/**
 * Public API versions.
 *
 * - Every version is mounted under `/api/<version>` and has its own OpenAPI document.
 * - Only one version is `current`; older ones stay available as `deprecated` aliases
 *   until their sunset date, so existing clients keep working while they migrate.
 * - `specVersion` is the version of the API contract (OpenAPI `info.version`),
 *   independent of the application version in package.json.
 */
export const API_VERSIONS = Object.freeze({
  v1: Object.freeze({
    status: 'deprecated',
    specVersion: '1.0.0',
    successor: 'v2',
    deprecatedAt: '2026-11-17T00:00:00Z',
  }),
  v2: Object.freeze({
    status: 'current',
    specVersion: '2.0.0',
  }),
});

export const CURRENT_API_VERSION = 'v2';

export const SUPPORTED_API_VERSIONS = Object.freeze(Object.keys(API_VERSIONS));

/** @param {string} version */
export const apiPrefix = (version) => `/api/${version}`;

export const API_PREFIX = apiPrefix(CURRENT_API_VERSION);
