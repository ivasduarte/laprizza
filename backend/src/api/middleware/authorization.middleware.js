import { AuthErrorCode, authError } from '../../application/auth/auth-errors.js';
import { GUEST_PERMISSIONS, hasPermission } from '../../domain/auth/permissions.domain.js';
import { requestContext } from './request-context.js';

const GUEST_PRINCIPAL = Object.freeze({
    guest: true,
    roles: Object.freeze([]),
    permissions: GUEST_PERMISSIONS,
});

function resolvePrincipal(req, res, next) {
    if (req.principal) return next();

    if (!req.headers?.authorization) {
        req.principal = GUEST_PRINCIPAL;
        return next();
    }

    const authenticate = req.app?.locals?.authenticate;
    if (!authenticate) return next(new Error('Authorization middleware is not configured.'));

    return authenticate(req, res, (err) => {
        if (err) return next(err);
        req.principal = { guest: false, ...req.user };
        next();
    });
}

function denyGuest(req, next, required) {
    req.app?.locals?.securityLogger?.log('ACCESS_DENIED', {
        ...requestContext(req),
        required,
        reason: AuthErrorCode.TOKEN_MISSING,
    });
    return next(authError(AuthErrorCode.TOKEN_MISSING, 401));
}

export function requirePermission(permission) {
    const middleware = (req, res, next) => 
        resolvePrincipal(req, res, (err) => {
            if (err) return next(err);

            const principal = req.principal;
            if (hasPermission(principal.permissions, permission)) return next();
            if (principal.guest) return denyGuest(req, next, permission);

            req.app?.locals?.securityLogger?.log('ACCESS_DENIED', {
                userId: principal.userId,
                roles: principal.roles,
                ...requestContext(req),
                required: permission,
                reason: 'MISSING_PERMISSION',
            });
            return next(authError(AuthErrorCode.FORBIDDEN, 403));
        });
    
    middleware.permission = permission;
    return middleware;
}

export function requireAuthenticated(req, res, next) {
    return resolvePrincipal(req, res, (err) => {
        if (err) return next(err);
        if (req.principal.guest) return denyGuest(req, next, 'authenticated');
        next();
    });
}
requireAuthenticated.authenticatedOnly = true;