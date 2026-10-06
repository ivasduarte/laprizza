import * as compTypeRepository from '../infrastructure/pizza-component-type.repository.js';

export async function listComponents() {
  return compTypeRepository.list();
}
