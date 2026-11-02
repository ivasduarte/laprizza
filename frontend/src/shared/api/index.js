import { getApiBaseUrl } from '../../health.js';
import { createHttpClient } from './http-client.js';

export const api = createHttpClient({ baseUrl: getApiBaseUrl() });
