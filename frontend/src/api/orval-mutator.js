import { api } from '../shared/api/index.js';

export const axiosInstance = (config, options) => {
  return api.request(config.url, {
    method: config.method,
    query: config.params,
    body: config.data,
    signal: options?.signal ?? config.signal,
  });
};
