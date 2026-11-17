import morgan from 'morgan';

/** Path without the query string */
morgan.token('path-only', (req) => (req.originalUrl ?? req.url ?? '').split('?')[0]);

const FORMATS = Object.freeze({
  production:
    'remote-addr - [:date[clf]] ":method :path-only HTTP/:http-version" :status :res[content-length] ":user-agent"',
  development: ':method :path-only :status :response-time ms - :res[content-length]',
});

export function createRequestLogger(nodeEnv, { stream } = {}) {
    const format = nodeEnv === 'production' ? FORMATS.production : FORMATS.development;
    return morgan(format, stream ? { stream } : {});
}