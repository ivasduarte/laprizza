import { AppError } from '../app-error.js';

export const AuthErrorCode = Object.freeze({
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',
  RATE_LIMITED: 'RATE_LIMITED',
  TOKEN_MISSING: 'TOKEN_MISSING',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  SESSION_REVOKED: 'SESSION_REVOKED',
  REFRESH_INVALID: 'REFRESH_INVALID',
  ORIGIN_NOT_ALLOWED: 'ORIGIN_NOT_ALLOWED',
  RESET_TOKEN_INVALID: 'RESET_TOKEN_INVALID',
  PASSWORD_POLICY_VIOLATION: 'PASSWORD_POLICY_VIOLATION',
  CURRENT_PASSWORD_INCORRECT: 'CURRENT_PASSWORD_INCORRECT',
  FORBIDDEN: 'FORBIDDEN',
  NO_ACTIVE_ROLE: 'NO_ACTIVE_ROLE',
  ROLES_UNAVAILABLE: 'ROLES_UNAVAILABLE',
  INVITATION_INVALID: 'INVITATION_INVALID',
  INVITATION_MISMATCH: 'INVITATION_MISMATCH',
  PHONE_INVALID: 'PHONE_INVALID',
});

const DEFAULT_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid credentials.',
  ACCOUNT_INACTIVE: 'Account is not active.',
  ACCOUNT_DISABLED: 'Account is disabled.',
  TOO_MANY_ATTEMPTS: 'Too many failed attempts. Try again later.',
  RATE_LIMITED: 'Too many requests. Try again later.',
  TOKEN_MISSING: 'Authentication required.',
  TOKEN_INVALID: 'Invalid access token.',
  TOKEN_EXPIRED: 'Access token expired.',
  SESSION_REVOKED: 'Session is no longer valid.',
  REFRESH_INVALID: 'Session is no longer valid.',
  ORIGIN_NOT_ALLOWED: 'Origin not allowed.',
  RESET_TOKEN_INVALID: 'Invalid or expired recovery link.',
  CURRENT_PASSWORD_INCORRECT: 'Current password is incorrect.',
  FORBIDDEN: 'Forbidden.',
  NO_ACTIVE_ROLE: 'The account has no active role.',
  ROLES_UNAVAILABLE: 'The account roles could not be confirmed. Try again later.',
  INVITATION_INVALID: 'Invalid, expired or already used activation link.',
  INVITATION_MISMATCH: 'The authenticated identity is not the one this invitation was sent to.',
  PHONE_INVALID: 'Invalid phone number.',
};

export function authError(code, status, message = DEFAULT_MESSAGES[code] ?? code) {
    return new AppError(message, status, null, code);
}

export function tooManyAttempts(code, retryAfterMs) {
    const err = authError(code, 429);
    err.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return err;
}
