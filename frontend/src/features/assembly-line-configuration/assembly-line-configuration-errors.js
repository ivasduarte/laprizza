/**
 * Maps API errors to user-friendly translation keys.
 * 409 only happens on delete: the line is referenced by a kitchen configuration.
 *
 * Kept free of imports so it can be unit tested with `node --test`.
 */
export function getAssemblyLineErrorKey(error) {
  if (!error || !error.status) return 'assemblyLine.errors.default';

  switch (error.status) {
    case 400:
      return 'assemblyLine.errors.invalid';
    case 404:
      return 'assemblyLine.errors.notFound';
    case 409:
      return 'assemblyLine.errors.referenced';
    default:
      return 'assemblyLine.errors.default';
  }
}
