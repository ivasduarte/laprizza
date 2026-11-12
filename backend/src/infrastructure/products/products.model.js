import mongoose from 'mongoose';
import { componentSizeConfigurationSchema } from '../component-size-configuration/component-size-configuration.model.js';

const aggregateItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Products', required: true },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'Quantity must be an integer' },
    },
  },
  { _id: false },
);

const aggregateSchema = new mongoose.Schema(
  {
    classification: { type: String, enum: ['PRODUCED', 'PURCHASED'], required: true },
    items: { type: [aggregateItemSchema], default: [] },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, default: 0, min: 0 },
    sellable: { type: Boolean, required: true, default: false },
    stockControlled: { type: Boolean, required: true, default: false },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product Categories', required: true },
    pizzaComponentTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pizza Component Type',
      default: null,
    },
    allergenIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Allergen' }],
    sizeConfigurations: { type: [componentSizeConfigurationSchema], default: [] },
    aggregate: { type: aggregateSchema, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model('Products', productSchema);
