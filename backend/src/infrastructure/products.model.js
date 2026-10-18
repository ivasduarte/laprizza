import mongoose from 'mongoose';

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
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model('Products', productSchema);
