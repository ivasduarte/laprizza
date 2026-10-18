import Products from './products.model.js';
import mongoose from 'mongoose';
import { escapeRegex } from './utils/escape-regex.js';

export async function create(productData) {
  return Products.create(productData);
}

export async function update(id, updateData) {
  if (!mongoose.isValidObjectId(id)) return null;

  return Products.findByIdAndUpdate(id, updateData, {
    returnDocument: 'after',
    runValidators: true,
  })
    .populate('categoryId')
    .populate('allergenIds')
    .populate('pizzaComponentTypeId');
}

export async function listProducts(query = {}) {
  const filter = {};
  const term = query.search?.trim();

  if (term) {
    const regex = new RegExp(escapeRegex(term), 'i');
    filter.$or = [{ name: regex }, { description: regex }];
  }

  if (query.categoryId) filter.categoryId = query.categoryId;
  if (query.isActive !== undefined) filter.isActive = query.isActive;

  return Products.find(filter)
    .populate('categoryId')
    .populate('allergenIds')
    .populate('pizzaComponentTypeId');
}

export async function findById(id) {
  if (!mongoose.isValidObjectId(id)) return null;

  return Products.findById(id)
    .populate('categoryId')
    .populate('allergenIds')
    .populate('pizzaComponentTypeId');
}

export async function findByName(name) {
  return await Products.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
}
