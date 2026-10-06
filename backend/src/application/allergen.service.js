import * as allergenRepository from '../infrastructure/allergen.repository.js';

export async function listAllergens() {
  return allergenRepository.list();
}