import { api } from '../../shared/api/index.js';

const resourcePath = (name) => `/shared-resources/${encodeURIComponent(name)}`;

// The page shows every failure inline (message + retry), so no global toast on top of it.
export const sharedResourcesApi = {
  list(signal) {
    return api.get('/shared-resources', { signal, feedback: 'silent' });
  },
  download(name) {
    return api.get(resourcePath(name), {
      responseType: 'blob',
      feedback: 'silent',
    });
  },
  async upload(name, file) {
    const { status } = await api.put(resourcePath(name), file, {
      contentType: 'application/octet-stream',
      withStatus: true,
      feedback: 'silent',
    });
    return status === 201 ? 'created' : 'replaced';
  },
  remove(name) {
    return api.delete(resourcePath(name), { feedback: 'silent' });
  },
};
