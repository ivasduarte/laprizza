import mongoose from 'mongoose';

const assemblyLineConfigurationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

export default mongoose.model('Assembly Line Configuration', assemblyLineConfigurationSchema);
