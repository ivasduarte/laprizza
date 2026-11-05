import Axios from 'axios';

const AXIOS_INSTANCE = Axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'api/v1',
});

AXIOS_INSTANCE.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * @template T
 * @param {{ url: string, method: string, params?: object, data?: unknown, signal?: AbortSignal }} config
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<T>}
 */
export const axiosInstance = (config, options) =>
  AXIOS_INSTANCE({ ...config, ...options }).then(({ data }) => data);
