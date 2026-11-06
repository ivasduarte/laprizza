import mongoose from 'mongoose';
import KitchenConfiguration from './kitchen-configuration.model.js';

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

/**
* Atomic activation using transactions.
* Deactivates the currently active configuration and activates the new one.
 */
export async function activateAtomic(id) {
  if (!mongoose.isValidObjectId(id)) return null;

  const session = await mongoose.startSession();
  let activatedConfig = null;

  try {
    await session.withTransaction(async () => {
      // 1. Disable any currently active settings
      await KitchenConfiguration.updateMany(
        { isActive: true },
        { $set: { isActive: false } },
        { session },
      );

      // 2. Activate the new setting
      activatedConfig = await KitchenConfiguration.findByIdAndUpdate(
        id,
        { $set: { isActive: true } },
        { returnDocument: 'after', session },
      );

      if (!activatedConfig) {
        throw new Error('Configuration not found during activation');
      }
    });
  } finally {
    await session.endSession();
  }

  return activatedConfig;
}