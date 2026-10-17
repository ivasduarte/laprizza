import mongoose from 'mongoose';

const pizzaSizeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  isActive: { type: Boolean, default: true}
});

export default mongoose.model('Pizza Size', pizzaSizeSchema);
