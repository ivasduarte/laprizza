const MAX_USER_AGENT_LENGTH = 200;

export function requestContext(req) {
  const base = req.baseUrl ?? '';
  return {
    ip: req.ip,
    method: req.method,
    path: `${base}${req.path ?? ''}`,
    route: req.route?.path ? `${base}${req.route.path}` : undefined,
    userAgent: req.headers?.['user-agent']?.slice(0, MAX_USER_AGENT_LENGTH),
  };
}
