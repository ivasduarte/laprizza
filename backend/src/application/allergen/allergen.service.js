import * as defaultAllergenRepository from '../../infrastructure/allergen/allergen.repository.js';
import { validateAllergenName } from '../../domain/allergen/allergen.domain.js';
import { AppError } from '../app-error.js';
import { invalidate } from '../../infrastructure/cache/cache.js';

export function toAllergenDto(allergen) {
  return {
    id: allergen._id || allergen.id,
    name: allergen.name,
    isActive: allergen.isActive !== false,
  };
}

function validateName(name) {
  try {
    return validateAllergenName(name);
  } catch (err) {
    throw new AppError(err.message, 400);
  }
}

export async function listAllergens(filters = {}, allergenRepository = defaultAllergenRepository) {
  const allergens = filters.name
    ? await allergenRepository.search(filters.name)
    : await allergenRepository.list();

  const activeAllergens = allergens.filter((a) => a.isActive !== false);
  return activeAllergens.map(toAllergenDto);
}

export async function getAllergenById(id, allergenRepository = defaultAllergenRepository) {
  const allergen = await allergenRepository.findById(id);

  if (!allergen || allergen.isActive === false) {
    throw new AppError('Allergen not found.', 404);
  }

  return toAllergenDto(allergen);
}

export async function getAllergenByName(name, allergenRepository = defaultAllergenRepository) {
  const allergen = await allergenRepository.findByName(name);

  if (!allergen || allergen.isActive === false) {
    throw new AppError('Allergen not found.', 404);
  }

  return toAllergenDto(allergen);
}

export async function createAllergen(allergenData, allergenRepository = defaultAllergenRepository) {
  const name = validateName(allergenData.name);

  try {
    const newAllergen = await allergenRepository.create({ name, isActive: true });
    await invalidate('catalogue');
    return toAllergenDto(newAllergen);
  } catch (err) {
    if (err.code === 11000) throw new AppError('Allergen name already in use.', 409);
    throw err;
  }
}

export async function updateAllergen(
  id,
  updateData,
  allergenRepository = defaultAllergenRepository,
) {
  if (updateData.isActive !== false) {
    throw new AppError('Only deactivation is supported: isActive must be false.', 400);
  }

  const allergen = await allergenRepository.findById(id);
  if (!allergen || allergen.isActive === false) {
    throw new AppError('Allergen not found.', 404);
  }

  if (await allergenRepository.isReferenced(id)) {
    throw new AppError(
      'Allergen is referenced by existing products or customers and cannot be deactivated.',
      409,
    );
  }

  const deactivated = await allergenRepository.update(id, { isActive: false });
  await invalidate('catalogue');
  return toAllergenDto(deactivated);
}
