import { fetchRefreshedSession } from '../../shared/api/index.js';
import { sessionStore } from '../../shared/auth/session-store.js';

const API_URL = `${import.meta.env?.VITE_API_BASE_URL ?? '/api/v1'}/shared-resources`;

export class ApiError extends Error {
  constructor(status) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

function send(path, options) {
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${sessionStore.getAccessToken()}`,
      ...options.headers,
    },
  });
}

async function call(path, options = {}) {
  let response;
  try {
    response = await send(path, options);
    if (
      response.status === 401 &&
      (await sessionStore.refresh(fetchRefreshedSession))
    ) {
      response = await send(path, options);
    }
  } catch {
    throw new ApiError(0);
  }
  if (response.status === 401) sessionStore.end({ expired: true });
  if (!response.ok) throw new ApiError(response.status);
  return response;
}

export async function listResources(signal) {
  const response = await call('', { signal });
  return response.json();
}

export async function downloadResource(name) {
  const response = await call(`/${encodeURIComponent(name)}`);
  return response.blob();
}

export async function uploadResource(name, file) {
  const response = await call(`/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
  });
  return response.status === 201 ? 'created' : 'replaced';
}

export async function deleteResource(name) {
  await call(`/${encodeURIComponent(name)}`, { method: 'DELETE' });
}
