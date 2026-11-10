import { api } from '../../shared/api/index.js';

const resourcePath = (name) => `/shared-resources/${encodeURIComponent(name)}`;

export const sharedResourcesApi = {
  list(signal) {
    return api.get('/shared-resources', { signal });
  },
  download(name) {
    return api.get(resourcePath(name), { responseType: 'blob' });
  },
  async upload(name, file) {
    const { status } = await api.put(resourcePath(name), file, {
      contentType: 'application/octet-stream',
      withStatus: true,
    });
    return status === 201 ? 'created' : 'replaced';
  },
  remove(name) {
    return api.delete(resourcePath(name));
  },
};

/**
 * Maps API errors to user-friendly translation keys.
 */
export function getSharedResourcesErrorKey(error) {
  switch (error?.status) {
    case 0:
      return 'sharedResources.err.network';
    case 400:
      return 'sharedResources.err.invalid';
    case 401:
      return 'sharedResources.err.session';
    case 403:
      return 'sharedResources.err.forbidden';
    case 404:
      return 'sharedResources.err.notFound';
    case 413:
      return 'sharedResources.err.tooLarge';
    default:
      return 'sharedResources.err.generic';
  }
}
