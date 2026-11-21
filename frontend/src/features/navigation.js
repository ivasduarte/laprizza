import { can } from '../shared/auth/permissions.js';

/**
 * Sections of the ☰ menu, in display order. A feature joins one through `navGroup`; features
 * without it (Home) are listed first, without a title.
 */
export const NAV_GROUPS = Object.freeze([
  { id: 'kitchen', labelKey: 'nav.groups.kitchen' },
  { id: 'menu', labelKey: 'nav.groups.menu' },
  { id: 'customers', labelKey: 'nav.groups.customers' },
  { id: 'administration', labelKey: 'nav.groups.administration' },
]);

export function visibleFeatures(features, { permissions, authenticated }) {
  return features.filter(
    (feature) =>
      feature.showInNav !== false &&
      (!feature.requiresAuth || authenticated) &&
      can(permissions, feature.permission)
  );
}

/**
 * Splits the visible features into the menu sections. Empty sections are dropped, so a
 * visitor never sees a title without links. Features keep their registry order.
 *
 * @param {Array<{id: string, navGroup?: string}>} features - already filtered (visibleFeatures).
 * @returns {Array<{id: string|null, labelKey: string|null, items: object[]}>}
 */
export function groupFeatures(features) {
  const known = new Set(NAV_GROUPS.map((group) => group.id));
  const sections = [
    {
      id: null,
      labelKey: null,
      // An unknown group is shown untitled rather than hidden.
      items: features.filter((f) => !f.navGroup || !known.has(f.navGroup)),
    },
    ...NAV_GROUPS.map((group) => ({
      ...group,
      items: features.filter((f) => f.navGroup === group.id),
    })),
  ];
  return sections.filter((section) => section.items.length > 0);
}

/**
 * WEB02: breadcrumb trail of the current page, built from the registry and the URL:
 * Home › Section › Page › (New | Detail › Edit). The last crumb is the current page (no link).
 *
 * @param {string} pathname
 * @param {URLSearchParams} params - `id` opens a detail, `mode=new|edit` a form.
 * @param {Array<{id: string, path: string, labelKey: string, navGroup?: string}>} features
 * @returns {Array<{labelKey: string, to?: string}>} empty on the home page and unknown paths.
 */
export function breadcrumbTrail(pathname, params, features) {
  const feature = features.find((f) => f.path === pathname);
  if (!feature || feature.path === '/') return [];

  const group = NAV_GROUPS.find((g) => g.id === feature.navGroup);
  const id = params.get('id');
  const mode = params.get('mode');
  const trail = [{ labelKey: 'nav.home', to: '/' }];
  if (group) trail.push({ labelKey: group.labelKey });
  trail.push({ labelKey: feature.labelKey, to: feature.path });

  if (mode === 'new') {
    trail.push({ labelKey: 'breadcrumbs.new' });
  } else if (id) {
    const detail = `${feature.path}?id=${encodeURIComponent(id)}`;
    trail.push({ labelKey: 'breadcrumbs.detail', to: detail });
    if (mode === 'edit') trail.push({ labelKey: 'breadcrumbs.edit' });
  }

  // The current page is never a link.
  const last = trail.at(-1);
  delete last.to;
  return trail;
}
