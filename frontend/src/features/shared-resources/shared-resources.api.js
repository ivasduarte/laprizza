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
