import express from 'express';
import { createApp, loadConfig } from '../../src/index.js';

/**
 * Lists every route of the API with its guard, by building the real app.
 * Express 5 does not keep the mount path of sub-routers, so Router#use is observed while the
 * app is built to record "mount path -> router".
 *
 * @returns {{method: string, path: string, permission: string|null, authenticatedOnly: boolean}[]}
 *   path is relative to the API version prefix (e.g. "/customers/:id").
 */
export function listApiRoutes() {
  const routerPrototype = Object.getPrototypeOf(Object.getPrototypeOf(express.Router()));
  const originalUse = routerPrototype.use;
  const mounts = [];

  routerPrototype.use = function use(...args) {
    const paths = typeof args[0] === 'function' ? ['/'] : [].concat(args[0]);
    for (const handler of args.filter((arg) => typeof arg === 'function')) {
      for (const path of paths) mounts.push({ path, handler });
    }
    return originalUse.apply(this, args);
  };
  try {
    createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'route-inventory' }), { inventory: true });
  } finally {
    routerPrototype.use = originalUse;
  }

  const routes = [];
  const seen = new Set();
  for (const mount of mounts) {
    for (const layer of mount.handler.stack ?? []) {
      if (!layer.route) continue;
      const handlers = layer.route.stack.map((entry) => entry.handle);
      const path = `${mount.path}${layer.route.path}`
        .replace(/\/{2,}/g, '/')
        .replace(/(.)\/$/, '$1')
        .replace(/^\/api\/v\d+(?=\/|$)/, ''); // every API version mounts the same routes
      for (const method of Object.keys(layer.route.methods)) {
        const id = `${method.toUpperCase()} ${path}`;
        if (seen.has(id)) continue;
        seen.add(id);
        routes.push({
          method: method.toUpperCase(),
          path,
          permission: handlers.find((h) => h.permission)?.permission ?? null,
          authenticatedOnly: handlers.some((h) => h.authenticatedOnly),
        });
      }
    }
  }
  return routes;
}
