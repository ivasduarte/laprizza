import mongoose from 'mongoose';
import { ActorKind } from '../../domain/users/role-changes.domain.js';

/**
 * AA06: activation invitation of an inactive account. Only the SHA-256 of the token is stored.
 * Expired documents are removed by the TTL index; used or replaced ones keep their dates
 * until then.
 */
const activationInvitationSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true, index: true },
    email: { type: String, required: true },
    issuedBy: {
      kind: { type: String, enum: Object.values(ActorKind), required: true },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', default: null },
      process: { type: String, default: null },
    },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { collection: 'Activation Invitations', versionKey: false },
);

activationInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('ActivationInvitation', activationInvitationSchema);
