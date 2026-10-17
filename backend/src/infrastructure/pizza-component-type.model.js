import mongoose from 'mongoose';

export const NAME_COLLATION = { locale: 'en', strength: 1 };

const isIntegerOrNull = (value) => value === null || Number.isInteger(value);

const pizzaComponentTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  assemblyOrder: {
    type: Number,
    required: true,
    min: 1,
    validate: { validator: isIntegerOrNull, message: 'assemblyOrder must be an integer' },
  },
  minQuantity: {
    type: Number,
    required: true,
    min: 0,
    validate: { validator: isIntegerOrNull, message: 'minQuantity must be an integer' },
  },
  maxQuantity: {
    type: Number,
    default: null,
    min: 1,
    validate: { validator: isIntegerOrNull, message: 'maxQuantity must be an integer or null' },
  },
  isActive: { type: Boolean, default: true },
});

pizzaComponentTypeSchema.index({ name: 1 }, { unique: true, collation: NAME_COLLATION, partialFilterExpression: { isActive: true } });
pizzaComponentTypeSchema.index({ assemblyOrder: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

export default mongoose.model('Pizza Component Type', pizzaComponentTypeSchema);
