import mongoose from 'mongoose';
import KitchenConfiguration from './kitchen-configuration.model.js';

export const ACTIVATION_TARGET_NOT_FOUND = 'ACTIVATION_TARGET_NOT_FOUND';

export async function create(data) {
  return KitchenConfiguration.create(data);
}

export async function list() {
  return KitchenConfiguration.find().sort({ createdAt: -1 });
}

export async function findById(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return KitchenConfiguration.findById(id);
}

export async function getActive() {
  return KitchenConfiguration.findOne({ isActive: true });
}

export async function update(id, updateData) {
  if (!mongoose.isValidObjectId(id)) return null;
  return KitchenConfiguration.findByIdAndUpdate(id, updateData, {
    returnDocument: 'after',
    runValidators: true,
  });
}

export async function remove(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return KitchenConfiguration.findByIdAndDelete(id);
}

function activationTargetNotFound() {
  const notFound = new Error('Configuration not found during activation');
  notFound.code = ACTIVATION_TARGET_NOT_FOUND;
  return notFound;
}

async function restorePrevious(previous, id, model, logger) {
  if (!previous || String(previous._id) === String(id)) return;
  try {
    await model.updateOne({ _id: previous._id }, { $set: { isActive: true } });
  } catch (err) {
    // A concurrent activation already made another configuration active: nothing to restore.
    if (err?.code !== 11000) {
      logger.error(
        `Kitchen configuration activation: could not restore the previous active configuration ${previous._id}.`,
        err,
      );
    }
  }
}

/**
 * Activates a configuration and deactivates the current one, with plain sequential updates
 * (no transactions, like the other repositories; the MongoDB server is standalone).
 *
 * The partial unique index guarantees that at most one configuration is active. Between steps 2
 * and 3 there is briefly none; if step 3 fails (target deleted, or a concurrent activation won:
 * duplicate key 11000, answered 409 by the service) the previous one is restored.
 *
 * @param {string} id
 * @param {{model?: object, logger?: Pick<Console, 'error'>}} [deps] Injected in unit tests.
 */
export async function activateAtomic(id, { model = KitchenConfiguration, logger = console } = {}) {
  if (!mongoose.isValidObjectId(id)) return null;

  // 1. Remember the configuration that is active now (to restore it on failure)
  const previous = await model.findOne({ isActive: true }, { _id: 1 });

  // 2. Deactivate it
  await model.updateMany({ isActive: true, _id: { $ne: id } }, { $set: { isActive: false } });

  // 3. Activate the target
  let activatedConfig;
  try {
    activatedConfig = await model.findByIdAndUpdate(
      id,
      { $set: { isActive: true } },
      { returnDocument: 'after' },
    );
  } catch (err) {
    await restorePrevious(previous, id, model, logger);
    throw err;
  }

  if (!activatedConfig) {
    await restorePrevious(previous, id, model, logger);
    throw activationTargetNotFound();
  }
  return activatedConfig;
}
