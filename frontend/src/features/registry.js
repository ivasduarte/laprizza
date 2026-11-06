export const features = [
  {
    id: 'home',
    path: '/',
    labelKey: 'nav.home',
    load: () => import('./home/home-page.jsx'),
  },
  {
    id: 'visualization3d',
    path: '/visualization3d',
    labelKey: 'nav.visualization3d',
    load: () => import('./visualization3d/visualization3d-page.jsx'),
  },
  {
    id: 'ai',
    path: '/ai',
    labelKey: 'nav.ai',
    load: () => import('./ai/ai-page.jsx'),
  },
  {
    id: 'login',
    path: '/login',
    labelKey: 'nav.login',
    showInNav: false,
    load: () => import('./login/login-page.jsx'),
  },
  {
    id: 'change-password',
    path: '/change-password',
    labelKey: 'nav.changePassword',
    showInNav: false,
    load: () => import('./change-password/change-password-page.jsx'),
  },
  {
    id: 'forgot-password',
    path: '/forgot-password',
    labelKey: 'nav.forgotPassword',
    showInNav: false,
    load: () => import('./forgot-password/forgot-password-page.jsx'),
  },
  {
    id: 'reset-password',
    path: '/reset-password',
    labelKey: 'nav.resetPassword',
    showInNav: false,
    load: () => import('./reset-password/reset-password-page.jsx'),
  },
  {
    id: 'kitchen-configuration',
    path: '/kitchen-configurations',
    labelKey: 'nav.kitchenConfig',
    load: () =>
      import('./kitchen-configuration/kitchen-configuration-page.jsx'),
  },
];
