import mongoose from 'mongoose';

const forecastEntrySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  sizeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PizzaSize',
    default: null,
  },
  quantity: { type: Number, required: true, min: 0 },
});

const forecastSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    entries: [forecastEntrySchema],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

forecastSchema.index(
  { name: 1, version: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);

export default mongoose.model('Forecast', forecastSchema);
