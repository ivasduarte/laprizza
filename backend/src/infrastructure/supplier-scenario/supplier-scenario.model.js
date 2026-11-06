import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
});

const offerSchema = new mongoose.Schema({
  supplierId: { type: String, required: true },
  priceEur: { type: Number, required: true, min: 0 },
  stockUnits: { type: Number, required: true, min: 1 },
  leadTimeDays: { type: Number, required: true, min: 0 },
  supplyLimit: { type: Number, min: 0 },
});

const scenarioProductSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  offers: [offerSchema],
});

const supplierScenarioSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    version: { type: Number, default: 1 },
    simulated: { type: Boolean, default: true },
    suppliers: [supplierSchema],
    products: [scenarioProductSchema],
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const SupplierScenario = mongoose.model('SupplierScenario', supplierScenarioSchema);
