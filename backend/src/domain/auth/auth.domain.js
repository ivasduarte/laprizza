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

/**
 * A session is usable while it exists, is not revoked, has not reached its absolute expiry and
 * (AA04) was used within the inactivity window.
 *
 * @param {object|null} session
 * @param {Date} now
 * @param {{idleTimeoutMs?: number}} [options] - 0/absent disables the inactivity check.
 */
export function isSessionUsable(session, now, { idleTimeoutMs = 0 } = {}) {
    if (!session || session.revokedAt || new Date(session.expiresAt) <= now) return false;
    return !isSessionIdle(session, now, { idleTimeoutMs });
}

/**
 * AA04: true when the session was not used for longer than the inactivity window.
 *
 * @param {{lastUsedAt?: Date|string}} session
 * @param {Date} now
 * @param {{idleTimeoutMs?: number}} [options]
 */
export function isSessionIdle(session, now, { idleTimeoutMs = 0 } = {}) {
    if (!idleTimeoutMs || !session?.lastUsedAt) return false;
    return now.getTime() - new Date(session.lastUsedAt).getTime() >= idleTimeoutMs;
}

/** Oldest lastUsedAt still inside the inactivity window, or null when the check is disabled. */
export function idleCutoff(now, { idleTimeoutMs = 0 } = {}) {
    return idleTimeoutMs ? new Date(now.getTime() - idleTimeoutMs) : null;
}
