import { validatePasswordStrength } from '../../domain/users/users.domain.js';
import { AppError } from '../app-error.js';
import { AuthErrorCode } from './auth-errors.js';

export function assertPasswordPolicy(password) {
  try {
    validatePasswordStrength(password);
  } catch (err) {
    throw new AppError(err.message, 400, null, AuthErrorCode.PASSWORD_POLICY_VIOLATION);
  }
}