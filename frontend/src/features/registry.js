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
];
