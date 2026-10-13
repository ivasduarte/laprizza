/**
 * Error raised when a domain rule is violated.
 * It carries no HTTP concerns; the application layer decides how to expose it.
 */
export class DomainError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DomainError';
  }
}