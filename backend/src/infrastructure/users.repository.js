import Users from './users.model.js';

export async function list() {
  return [{ id: 1, name: 'Dummy User' }];
}