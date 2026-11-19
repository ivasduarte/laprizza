import { can } from '../shared/auth/permissions.js';

export function visibleFeatures(features, { permissions, authenticated }) {
  return features.filter(
    (feature) =>
      feature.showInNav !== false &&
      (!feature.requiresAuth || authenticated) &&
      can(permissions, feature.permission)
  );
}
