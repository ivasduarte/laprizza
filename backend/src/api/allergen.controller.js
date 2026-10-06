import * as allergenService from '../application/allergen.service.js';

export async function list(req, res) {
  const allergen = await allergenService.listAllergens();
  res.status(200).json(allergen);
}