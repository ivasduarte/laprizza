import * as predPizzaRepository from '../infrastructure/predefined-pizza.repository.js';

export async function listPredefinedPizzas() {
  return predPizzaRepository.list();
}