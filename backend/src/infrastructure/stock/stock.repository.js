import mongoose from 'mongoose';
import Stock from './stock.model.js';
import { escapeRegex } from '../utils/escape-regex.js';

export async function create(stockData) {
  return Stock.create(stockData);
}

export async function updateQuantity(productId, newQuantity) {
  if (!mongoose.isValidObjectId(productId)) return null;

  return Stock.findOneAndUpdate(
    { productId },
    { quantity: newQuantity },
    { returnDocument: 'after', runValidators: true },
  ).populate('productId');
}

export async function findByProductId(productId) {
  if (!mongoose.isValidObjectId(productId)) return null;
  return Stock.findOne({ productId }).populate('productId');
}

export async function listStock({ search, includeInactive = false } = {}) {
  const match = {};
  if (search) match.name = { $regex: escapeRegex(search), $options: 'i' };
  if (!includeInactive) match.isActive = { $ne: false };
  return Stock.find().populate({ path: 'productId', match });
}
