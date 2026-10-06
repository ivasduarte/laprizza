import * as usersService from '../application/users.service.js';

export async function list(req, res) {
  const users = await usersService.listUsers();
  res.status(200).json(users);
}