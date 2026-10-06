import * as sizeRepository from '../infrastructure/pizza-size.repository.js';

export async function listSizes() {
  return sizeRepository.list();
}
