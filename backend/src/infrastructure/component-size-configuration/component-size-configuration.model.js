import mongoose from 'mongoose';

const isIntegerOrNull = (value) => value === null || Number.isInteger(value);

export const componentSizeConfigurationSchema = new mongoose.Schema(
  {
    pizzaSizeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pizza Size', required: true },
    price: { type: Number, required: true, min: 0 },
    stockUnitsConsumed: {
      type: Number,
      default: null,
      min: 1,
      validate: {
        validator: isIntegerOrNull,
        message: 'stockUnitsConsumed must be an integer or null',
      },
    },
  },
  { _id: false },
);
