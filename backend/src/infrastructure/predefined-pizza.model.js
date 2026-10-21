import mongoose from 'mongoose';

const predefinedPizzaSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Products',
      required: true,
    },
    sizeIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pizza Size',
      },
    ],
    defaultConfiguration: {
      componentIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Products',
        },
      ],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

predefinedPizzaSchema.index({ productId: 1 }, { unique: true });

export default mongoose.model('PredefinedPizza', predefinedPizzaSchema);
