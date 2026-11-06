import mongoose from 'mongoose';

const kitchenConfigurationSchema = new mongoose.Schema(
    {
    name: { type: String, required: true, trim: true },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
    isActive: { type: Boolean, default: false }
    },
    { timestamps: true }
);

// Partial unique index: ensures that at most one document has isActive: true
kitchenConfigurationSchema.index(
    { isActive: 1 },
    { unique: true, partialFilterExpression: { isActive: true }}
);

export default mongoose.model('Kitchen Configurations', kitchenConfigurationSchema);