import mongoose from 'mongoose';

const kitchenConfigurationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Partial unique index: ensures that at most one document has isActive: true
// The name must match the one created by the migration (web06-kitchen-configurations.js),
// otherwise MongoDB rejects the second creation with an index name/options conflict.
kitchenConfigurationSchema.index(
  { isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
    name: 'active_kitchen_config_unique',
  },
);

export default mongoose.model('Kitchen Configurations', kitchenConfigurationSchema);