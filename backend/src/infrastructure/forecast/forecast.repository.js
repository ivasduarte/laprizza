import Forecast from './forecast.model.js';
import { escapeRegex } from '../utils/escape-regex.js';

const activeCondition = { isActive: { $ne: false } };

export async function list() {
  return Forecast.find({ ...activeCondition }).sort({ name: 1, version: 1 });
}

export async function search(name) {
  return Forecast.find({
    name: { $regex: escapeRegex(name), $options: 'i' },
    ...activeCondition,
  }).sort({ name: 1, version: 1 });
}

export async function findById(id) {
  return Forecast.findOne({ _id: id, ...activeCondition });
}

/** Highest version of a name (inactive ones included, so a version number is never reused); 0 if none. */
export async function getLatestVersion(name) {
  const latest = await Forecast.findOne({ name })
    .collation({ locale: 'en', strength: 2 })
    .sort({ version: -1 })
    .select('version')
    .lean();
  return latest?.version ?? 0;
}

export async function create(data) {
  return Forecast.create(data);
}

export async function update(id, data) {
  return Forecast.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true });
}
