import { SupplierScenario } from './supplier-scenario.model.js';
import { escapeRegex } from '../utils/escape-regex.js';

const activeCondition = { isActive: { $ne: false } };

export async function list() {
  return SupplierScenario.find({ ...activeCondition }).sort({ name: 1 });
}
export async function search(name) {
  return SupplierScenario.find({
    name: { $regex: escapeRegex(name), $options: 'i' },
    ...activeCondition,
  }).sort({ name: 1 });
}
export async function findById(id) {
  return SupplierScenario.findOne({ _id: id, ...activeCondition });
}
export async function create(data) {
  return SupplierScenario.create(data);
}
export async function update(id, data) {
  return SupplierScenario.findByIdAndUpdate(id, data, {
    returnDocument: 'after',
    runValidators: true,
  });
}
