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

// MongoDB answers "IllegalOperation" (code 20) when transactions are used on a standalone server
// (e.g. the DEI cloud MongoDB container, which cannot run as a replica set).
const ILLEGAL_OPERATION = 20;
const TRANSACTIONS_UNSUPPORTED_MESSAGE =
  /Transaction numbers are only allowed on a replica set member or mongos/i;

export function isTransactionUnsupported(err) {
  return (
    err?.code === ILLEGAL_OPERATION || TRANSACTIONS_UNSUPPORTED_MESSAGE.test(err?.message ?? '')
  );
}

function activationTargetNotFound() {
  const notFound = new Error('Configuration not found during activation');
  notFound.code = ACTIVATION_TARGET_NOT_FOUND;
  return notFound;
}

let warnedAboutFallback = false;

/** Test helper: the fallback warning is logged once per process. */
export function resetActivationFallbackWarning() {
  warnedAboutFallback = false;
}

/**
 * Deactivates the active configuration and activates the given one in a transaction
 * (replica set / Atlas). Nothing is written when the transaction cannot start.
 */
async function activateInTransaction(id, model, startSession) {
  const session = await startSession();
  let activatedConfig = null;

  try {
    await session.withTransaction(async () => {
      // 1. Disable any currently active settings
      await model.updateMany({ isActive: true }, { $set: { isActive: false } }, { session });

      // 2. Activate the new setting
      activatedConfig = await model.findByIdAndUpdate(
        id,
        { $set: { isActive: true } },
        { returnDocument: 'after', session },
      );

      // Aborts the transaction, so the previously active configuration is kept.
      if (!activatedConfig) throw activationTargetNotFound();
    });
  } finally {
    await session.endSession();
  }

  return activatedConfig;
}

/**
 * Fallback for servers without transactions. The partial unique index still guarantees that at
 * most one configuration is active; between steps 2 and 3 there is briefly none. If step 3 fails
 * (target deleted, or another activation won: duplicate key), the previous one is restored.
 */
async function activateSequentially(id, model, logger) {
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
 * Activates a configuration and deactivates the current one. Uses a transaction when the server
 * supports it; otherwise falls back to a sequential update with compensation (see above).
 *
 * @param {string} id
 * @param {{model?: object, startSession?: () => Promise<object>, logger?: Pick<Console, 'warn'|'error'>}} [deps]
 *   Injected in unit tests; production uses the Mongoose model.
 */
export async function activateAtomic(
  id,
  {
    model = KitchenConfiguration,
    startSession = () => mongoose.startSession(),
    logger = console,
  } = {},
) {
  if (!mongoose.isValidObjectId(id)) return null;

  try {
    return await activateInTransaction(id, model, startSession);
  } catch (err) {
    if (!isTransactionUnsupported(err)) throw err;
    if (!warnedAboutFallback) {
      warnedAboutFallback = true;
      logger.warn(
        'MongoDB does not support transactions (standalone server): kitchen configurations are activated without a transaction.',
      );
    }
    return activateSequentially(id, model, logger);
  }
}
