import mongoose from 'mongoose';
import PizzaComponentType, { NAME_COLLATION } from './pizza-component-type.model.js';

export async function create(typeData) {
  return PizzaComponentType.create(typeData);
}

export async function listPizzaComponentTypes() {
  return PizzaComponentType.find({isActive: true}).sort({ assemblyOrder: 1 });
}

export async function findById(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return PizzaComponentType.findById(id);
}

export async function searchByName(name) {
  const term = typeof name === 'string' ? name.trim() : '';
  if (!term) return [];

  return PizzaComponentType.find({name: term}).collation(NAME_COLLATION);
}

export async function update(id, updateData) {
  if (!mongoose.isValidObjectId(id)) return null;

  return PizzaComponentType.findByIdAndUpdate(id, updateData, {
    returnDocument: 'after',
    runValidators: true,
  });
}