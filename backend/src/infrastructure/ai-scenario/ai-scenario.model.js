import mongoose from 'mongoose';

export const AI_SCENARIO_COLLECTION = 'AI BOM Scenarios';

const isInteger = { validator: Number.isInteger, message: '{PATH} must be an integer' };

const scenarioOrderSchema = new mongoose.Schema(
    {
        pizzaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Products', required: true },
        sizeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pizza Size', required: true },
        quantity: { type: Number, required: true, min: 1, validate: isInteger },
    },
    { _id: false },
);

const scenarioStockSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Products', required: true },
    quantity: { type: Number, required: true, min: 0, validate: isInteger },
  },
  { _id: false },
);

const aiScenarioSchema = new mongoose.Schema(
    {
        code: { type: String, required: true, unique: true, trim: true, match: /^[A-Z0-9-]{1,64}$/ },
        name: { type: String, required: true, trim: true },
        description: { type: String, default: '', trim: true },
        version: { type: Number, required: true, min: 1, validate: isInteger },
        simulated: { type: Boolean, required: true, default: true },
        orders: { type: [scenarioOrderSchema], default: [] },
        stock: { type: [scenarioStockSchema], default: null },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true },
);

export default mongoose.model('AiScenario', aiScenarioSchema, AI_SCENARIO_COLLECTION);