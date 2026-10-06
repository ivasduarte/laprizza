import * as usersRepository from '../infrastructure/users.repository.js';

export async function listUsers() {
  return usersRepository.list();
}