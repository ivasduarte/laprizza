import mongoose from 'mongoose';
import Allergen from './allergen.model.js';
import Products from './products.model.js';
import Customers from './customers.model.js';
import { escapeRegex } from './utils/escape-regex.js';


const activeCondition = { isActive: { $ne: false } };

export async function list() {
  return Allergen.find({ ...activeCondition }).sort({ name: 1 });
}

export async function search(name) {
  return Allergen.find({ 
    name: { $regex: escapeRegex(name),$options: 'i' },
    ...activeCondition 
  }).sort({ name: 1 });
}

export async function findById(id) {
  return Allergen.findOne({ _id: id, ...activeCondition });
}

export async function findByName(name) {
  return Allergen.findOne({ 
    name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' },
    ...activeCondition 
  });
}

export async function create(data) {
  return Allergen.create(data);
}

export async function update(id, data) {
  return Allergen.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true });
}

export async function isReferenced(id) {
  const objectId = new mongoose.Types.ObjectId(id);
  const byProduct = await Products.exists({ allergenIds: objectId }).setOptions({ strictQuery: false });
  if (byProduct) return true;
  const byCustomer = await Customers.exists({ 'dietaryRestrictions.allergenIds': objectId }).setOptions({
    strictQuery: false,
  });
  return Boolean(byCustomer);
}