import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { features } from './features/registry.js';
import Layout from './shared/ui/layout.jsx';
import RequireAuth from './shared/auth/require-auth.jsx';
import NotFound from './shared/ui/not-found.jsx';

const routes = features.map((feature) => ({
  ...feature,
  Page: lazy(feature.load),
}));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {routes.map((route) => (
          <Route
            key={route.id}
            path={route.path}
            element={
              route.requiresAuth || route.permission ? (
                <RequireAuth
                  requiresAuth={Boolean(route.requiresAuth)}
                  requiresContactPhone={Boolean(route.requiresContactPhone)}
                  permission={route.permission}
                >
                  <route.Page />
                </RequireAuth>
              ) : (
                <route.Page />
              )
            }
          />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
