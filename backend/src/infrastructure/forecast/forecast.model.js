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
    name: { type: String, required: true },
    version: { type: Number, default: 1 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    entries: [forecastEntrySchema],
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

export const Forecast = mongoose.model('Forecast', forecastSchema);
export default Forecast;
