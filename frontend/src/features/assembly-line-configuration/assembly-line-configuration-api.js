import { api } from '../../shared/api/index.js';

/**
 * Library of assembly line definitions. Lines have no active state: the kitchen
 * configuration places one through `content.assemblyLine` (ADR: assembly line
 * referenced by the kitchen configuration).
 */
export const assemblyLineConfigurationApi = {
  list(options) {
    return api.get('/assembly-line-configurations', options);
  },
  getById(id, options) {
    return api.get(`/assembly-line-configurations/${id}`, options);
  },
  create(data) {
    return api.post('/assembly-line-configurations', data);
  },
  update(id, data) {
    return api.patch(`/assembly-line-configurations/${id}`, data);
  },
  remove(id) {
    return api.delete(`/assembly-line-configurations/${id}`);
  },
  validate(data) {
    return api.post('/assembly-line-configurations/validate', data);
  },
};

// Error mapping lives in a dependency-free module so it can be unit tested.
export { getAssemblyLineErrorKey } from './assembly-line-configuration-errors.js';
