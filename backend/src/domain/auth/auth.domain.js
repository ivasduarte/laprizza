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