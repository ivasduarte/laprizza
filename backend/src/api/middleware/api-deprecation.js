import { API_VERSIONS, apiPrefix } from '../api-versions.js';

/**
 * Adds the deprecation headers to every response of a deprecated API version:
 * - `Deprecation: @<unix-seconds>` (RFC 9745)
 * - `Link: </api/<successor>/...>; rel="successor-version"` (RFC 8288)
 * - `Sunset: <http-date>` (RFC 8594), only when a sunset date is configured.
 *
 * For a non-deprecated version it returns a no-op middleware.
 *
 * @param {string} version - API version key (e.g. 'v1').
 * @returns {import('express').RequestHandler}
 */
export function apiDeprecation(version) {
  const info = API_VERSIONS[version];
  if (!info || info.status !== 'deprecated') return (_req, _res, next) => next();

  const deprecation = `@${Math.floor(Date.parse(info.deprecatedAt) / 1000)}`;
  const sunset = info.sunsetAt ? new Date(info.sunsetAt).toUTCString() : undefined;
  const successorPrefix = info.successor ? apiPrefix(info.successor) : undefined;

  return (req, res, next) => {
    res.set('Deprecation', deprecation);
    if (sunset) res.set('Sunset', sunset);
    // req.url is relative to the mount point, so it maps 1:1 onto the successor prefix.
    if (successorPrefix) res.append('Link', `<${successorPrefix}${req.url}>; rel="successor-version"`);
    next();
  };
}
