import morgan from 'morgan';

/** Path without the query string */
morgan.token('path-only', (req) => (req.originalUrl ?? req.url ?? '').split('?')[0]);

// GDPR (GDP01): no client address, query string or user agent in the access log.
const FORMATS = Object.freeze({
  production: '[:date[clf]] ":method :path-only HTTP/:http-version" :status :res[content-length]',
  development: ':method :path-only :status :response-time ms - :res[content-length]',
});

export function createRequestLogger(nodeEnv, { stream } = {}) {
    const format = nodeEnv === 'production' ? FORMATS.production : FORMATS.development;
    return morgan(format, stream ? { stream } : {});
}