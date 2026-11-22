import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { features } from '../../src/features/registry.js';
import {
  breadcrumbTrail,
  groupFeatures,
  NAV_GROUPS,
  visibleFeatures,
} from '../../src/features/navigation.js';

/**
 * Permissions granted by the back end to each base role (AA05 matrix, Table 1), written by hand:
 * the menu must follow them, never role names.
 */
const PERMISSIONS = {
  GUEST: ['catalogue:read'],
  CUSTOMER: ['catalogue:read', 'customers:read:own', 'customers:write:own', 'resources:read'],
  EMPLOYEE: [
    'catalogue:read',
    'kitchen:read',
    'products:read',
    'resources:read',
    'stock:read',
  ],
  MANAGER: [
    'allergens:read',
    'allergens:write',
    'catalogue:read',
    'categories:write',
    'customers:read',
    'customers:write',
    'forecasts:read',
    'forecasts:write',
    'kitchen:read',
    'kitchen:write',
    'pizzas:write',
    'planning:execute',
    'products:read',
    'products:write',
    'resources:read',
    'stock:read',
    'stock:read:inactive',
    'stock:write',
    'suppliers:import',
    'suppliers:read',
  ],
  // AA06: user administration only
  ADMINISTRATOR: [
    'catalogue:read',
    'resources:read',
    'resources:write',
    'roles:assign:administrator',
    'roles:assign:customer',
    'roles:assign:employee',
    'roles:assign:manager',
    'users:create',
    'users:invite',
    'users:manage',
    'users:read',
  ],
  NO_ROLES: ['catalogue:read'],
};

const menuOf = (persona) =>
  visibleFeatures(features, {
    permissions: PERMISSIONS[persona],
    authenticated: persona !== 'GUEST',
  }).map((feature) => feature.id);

describe('Dynamic navigation menu (WEB03)', () => {
  it('a Guest only sees the public pages (WEB05: the catalogue is public)', () => {
    assert.deepEqual(menuOf('GUEST'), ['home', 'catalogue']);
  });

  it('a Customer also sees the shared resources (team decision)', () => {
    assert.deepEqual(menuOf('CUSTOMER'), [
      'home',
      'shared-resources',
      'catalogue',
      'my-data',
    ]);
  });

  it('a user without roles sees what a Guest sees', () => {
    assert.deepEqual(menuOf('NO_ROLES'), ['home', 'catalogue']);
  });

  it('an Employee sees the shared resources, the read-only catalogue pages and the kitchen viewer (Table 1)', () => {
    assert.deepEqual(menuOf('EMPLOYEE'), [
      'home',
      'visualization3d',
      'kitchen-configuration',
      'shared-resources',
      'product-categories',
      'pizza-sizes',
      'pizza-component-types',
      'products',
      'stock',
      'predefined-pizzas',
      'catalogue',
    ]);
  });

  it('a Manager also sees planning (AI)', () => {
    assert.deepEqual(menuOf('MANAGER'), [
      'home',
      'visualization3d',
      'ai',
      'kitchen-configuration',
      'shared-resources',
      'product-categories',
      'allergens',
      'pizza-sizes',
      'pizza-component-types',
      'products',
      'stock',
      'predefined-pizzas',
      'catalogue',
      'customers',
    ]);
  });

  it('an Administrator sees the user administration and the shared folder, nothing of the restaurant (AA06, SYS04)', () => {
    assert.deepEqual(menuOf('ADMINISTRATOR'), [
      'home',
      'shared-resources',
      'users',
      'catalogue',
    ]);
  });

  it('a Manager does not see the user administration (AA06)', () => {
    assert.ok(!menuOf('MANAGER').includes('users'));
  });

  it('several roles see the union of their pages', () => {
    const both = visibleFeatures(features, {
      permissions: [
        ...new Set([...PERMISSIONS.MANAGER, ...PERMISSIONS.EMPLOYEE]),
      ],
      authenticated: true,
    }).map((feature) => feature.id);
    assert.deepEqual(both, menuOf('MANAGER'));
  });

  it('never lists pages that are hidden from the menu (login, recovery, change password)', () => {
    const everything = visibleFeatures(features, {
      permissions: PERMISSIONS.MANAGER,
      authenticated: true,
    }).map((feature) => feature.id);
    for (const hidden of [
      'login',
      'forgot-password',
      'reset-password',
      'change-password',
    ]) {
      assert.ok(!everything.includes(hidden), hidden);
    }
  });

  it('a page that needs a session is hidden without one, even if its permission is granted', () => {
    const page = {
      id: 'x',
      showInNav: true,
      requiresAuth: true,
      permission: 'catalogue:read',
    };
    assert.deepEqual(
      visibleFeatures([page], {
        permissions: ['catalogue:read'],
        authenticated: false,
      }),
      []
    );
    assert.equal(
      visibleFeatures([page], {
        permissions: ['catalogue:read'],
        authenticated: true,
      }).length,
      1
    );
  });

  it('AA02: My data stays in the menu while the contact phone is missing (the guard asks for it)', () => {
    const withheld = ['catalogue:read', 'resources:read']; // customer without a phone
    const shown = (options) => visibleFeatures(features, options).map((f) => f.id);
    assert.ok(shown({ permissions: withheld, authenticated: true, phoneRequired: true }).includes('my-data'));
    assert.ok(!shown({ permissions: withheld, authenticated: true }).includes('my-data'));
    assert.ok(!shown({ permissions: withheld, authenticated: false, phoneRequired: true }).includes('my-data'));
  });

  it('fails closed with an empty or invalid permission list (only public pages)', () => {
    for (const permissions of [[], undefined, null]) {
      const ids = visibleFeatures(features, {
        permissions,
        authenticated: true,
      }).map((f) => f.id);
      assert.deepEqual(ids, ['home', 'catalogue'], String(permissions));
    }
  });
});

describe('Menu sections (☰ panel)', () => {
  const visible = (persona) =>
    visibleFeatures(features, {
      permissions: PERMISSIONS[persona],
      authenticated: true,
    });

  it('every menu feature belongs to a known section (only Home is untitled)', () => {
    const known = new Set(NAV_GROUPS.map((g) => g.id));
    const menu = features.filter((f) => f.showInNav !== false);
    const untitled = menu
      .filter((f) => !known.has(f.navGroup))
      .map((f) => f.id);
    assert.deepEqual(untitled, ['home']);
  });

  it('keeps every visible link exactly once, Home first', () => {
    for (const persona of Object.keys(PERMISSIONS)) {
      const flat = groupFeatures(visible(persona)).flatMap((s) =>
        s.items.map((f) => f.id)
      );
      assert.deepEqual(
        [...flat].sort(),
        visible(persona)
          .map((f) => f.id)
          .sort(),
        persona
      );
      assert.equal(flat[0], 'home', persona);
    }
  });

  it('drops empty sections, so no title appears without links', () => {
    for (const persona of Object.keys(PERMISSIONS)) {
      for (const section of groupFeatures(visible(persona))) {
        assert.ok(section.items.length > 0, `${persona}:${section.id}`);
      }
    }
    const guest = groupFeatures(
      visibleFeatures(features, {
        permissions: ['catalogue:read'],
        authenticated: false,
      })
    );
    assert.deepEqual(
      guest.map((s) => s.id),
      [null, 'menu']
    );
  });

  it('section titles are translated', async () => {
    const { messages } = await import('../../src/shared/i18n/message.js');
    for (const language of Object.keys(messages)) {
      for (const { labelKey } of NAV_GROUPS) {
        const text = labelKey
          .split('.')
          .reduce((n, k) => n?.[k], messages[language]);
        assert.ok(text, `${language}:${labelKey}`);
      }
    }
  });
});

describe('Breadcrumbs (WEB02)', () => {
  const trail = (path, query = '') =>
    breadcrumbTrail(path, new URLSearchParams(query), features).map(({ labelKey, to }) =>
      to ? `${labelKey}->${to}` : labelKey
    );

  it('shows Home > Section > Page, the page not being a link', () => {
    assert.deepEqual(trail('/stock'), ['nav.home->/', 'nav.groups.kitchen', 'nav.stock']);
  });

  it('adds the detail and the form levels, each one linking back to the previous', () => {
    assert.deepEqual(trail('/products', 'id=abc&mode=edit'), [
      'nav.home->/',
      'nav.groups.menu',
      'nav.products->/products',
      'breadcrumbs.detail->/products?id=abc',
      'breadcrumbs.edit',
    ]);
    assert.deepEqual(trail('/customers', 'mode=new').at(-1), 'breadcrumbs.new');
  });

  it('is empty on the home page and on unknown paths', () => {
    assert.deepEqual(trail('/'), []);
    assert.deepEqual(trail('/nope'), []);
  });

  it('has translated labels in both languages', async () => {
    const { messages } = await import('../../src/shared/i18n/message.js');
    for (const language of Object.keys(messages)) {
      for (const key of ['label', 'new', 'detail', 'edit']) {
        assert.ok(messages[language].breadcrumbs[key], `${language}:${key}`);
      }
    }
  });
});
