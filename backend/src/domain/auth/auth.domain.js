import { AccountStatus } from '../users/users.domain.js';

export const AuthenticationDenial = Object.freeze({
    ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
    ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
});

export function evaluateAuthentication(user) {
    if (user?.status === AccountStatus.ACTIVE) return { allowed: true };
    if (user?.status === AccountStatus.INACTIVE) {
        return { allowed: false, reason: AuthenticationDenial.ACCOUNT_INACTIVE };
    }

    return { allowed: false, reason:AuthenticationDenial.ACCOUNT_DISABLED };
}

export const AuthorizationDenial = Object.freeze({
    NO_ACTIVE_ROLE: 'NO_ACTIVE_ROLE',
});

/**
 * AA03: authentication alone gives no access. A session is only created for an account with
 * at least one active internal role.
 *
 * @param {string[]} roles - Active roles loaded from the back end (see activeRoles).
 */
export function evaluateRoleAuthorization(roles) {
    return Array.isArray(roles) && roles.length > 0
        ? { allowed: true }
        : { allowed: false, reason: AuthorizationDenial.NO_ACTIVE_ROLE };
}

export function computeLockoutDelayMs(failedCount, { threshold, stepsMs }) {
    if (!stepsMs.length || failedCount < threshold) return 0;
    return stepsMs[Math.min(failedCount - threshold, stepsMs.length - 1)];
}

export function remainingLockoutMs(lockedUntil, now) {
    if (!lockedUntil) return 0;
    return Math.max(0, new Date(lockedUntil).getTime() - now.getTime());
}

export function isSessionUsable(session, now) {
    return Boolean(session) && !session.revokedAt && new Date(session.expiresAt) > now;
}