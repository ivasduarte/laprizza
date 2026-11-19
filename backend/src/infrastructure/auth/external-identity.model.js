import mongoose from 'mongoose';
import { ExternalProvider } from '../../domain/auth/external-identity.domain.js';

const externalIdentitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true },
    provider: { type: String, enum: Object.values(ExternalProvider), required: true },
    issuer: { type: String, required: true, maxLength: 255 },
    subject: { type: String, required: true, maxLength: 255 },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { collection: 'External Identities', versionKey: false },
);

// One account per (issuer, sub); one identity per provider and user.
externalIdentitySchema.index({ issuer: 1, subject: 1 }, { unique: true });
externalIdentitySchema.index({ userId: 1, provider: 1 }, { unique: true });

export default mongoose.model('ExternalIdentity', externalIdentitySchema);
