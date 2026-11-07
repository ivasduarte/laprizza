import { api } from '../../src/shared/api/index.js';

export const kitchenConfigurationApi = {
  list() {
    return api.get('/kitchen-configurations');
  },
  getById(id) {
    return api.get(`/kitchen-configurations/${id}`);
  },
  getActive() {
    return api.get('/kitchen-configurations/active');
  },
  create(data) {
    return api.post('/kitchen-configurations', data);
  },
  update(id, data) {
    return api.patch(`/kitchen-configurations/${id}`, data);
  },
  remove(id) {
    return api.delete(`/kitchen-configurations/${id}`);
  },
  activate(id) {
    return api.patch(`/kitchen-configurations/${id}/activate`);
  },
  validate(data) {
    return api.post('/kitchen-configurations/validate', data);
  },
};

/**
 * Maps API errors to user-friendly translation keys.
 */
export function getKitchenConfigErrorKey(error) {
  if (!error || !error.status) return 'kitchenConfig.errors.default';

  switch (error.status) {
    case 400:
      return 'kitchenConfig.errors.invalid';
    case 404:
      return 'kitchenConfig.errors.notFound';
    case 409:
      return 'kitchenConfig.errors.conflict';
    default:
      return 'kitchenConfig.errors.default';
  }
}
