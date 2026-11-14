import mongoose from 'mongoose';
import AssemblyLineConfiguration from './assembly-line-configuration.model.js';
import KitchenConfiguration from '../kitchen-configuration/kitchen-configuration.model.js';

export async function create(data) {
  return AssemblyLineConfiguration.create(data);
}

export async function list() {
  return AssemblyLineConfiguration.find().sort({ createdAt: -1 });
}

export async function findById(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return AssemblyLineConfiguration.findById(id);
}

export async function update(id, updateData) {
  if (!mongoose.isValidObjectId(id)) return null;
  return AssemblyLineConfiguration.findByIdAndUpdate(id, updateData, {
    returnDocument: 'after',
    runValidators: true,
  });
}

export async function remove(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return AssemblyLineConfiguration.findByIdAndDelete(id);
}

/** Number of kitchen configurations whose content places this assembly line. */
export async function countKitchenConfigurationReferences(id) {
  return KitchenConfiguration.countDocuments({ 'content.assemblyLine.configurationId': String(id) });
}
