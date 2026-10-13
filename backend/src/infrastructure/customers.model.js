import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  phoneNumber: { type: String, required: true, unique: true, trim: true },
  address: {
    street: { type: String, required: true },
    houseNumber: { type: String, required: true },
    complement: { type: String },
    postalCode: { type: String, required: true },
    city: { type: String, required: true },
    district: { type: String, required: true },
  },
  dietaryRestrictions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Allergen',
    },
  ],
  isActive: { type: Boolean, default: true },
});

export default mongoose.model('Customers', customerSchema);