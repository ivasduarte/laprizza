import mongoose from 'mongoose';
import { Roles } from '../../domain/users/users.domain.js';
import { RoleChangeAction, ActorKind } from '../../domain/users/role-changes.domain.js';

/**
 * AA06: append-only record of every role assignment and removal (who, what, when).
 * The repository exposes no update or delete.
 */
const actorSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: Object.values(ActorKind), required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', default: null },
    process: { type: String, default: null },
  },
  { _id: false },
);

const roleChangeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true },
    role: { type: String, enum: Object.values(Roles), required: true },
    action: { type: String, enum: Object.values(RoleChangeAction), required: true },
    actor: { type: actorSchema, required: true },
    at: { type: Date, required: true },
  },
  { collection: 'Role Changes', versionKey: false },
);

roleChangeSchema.index({ userId: 1, at: -1 });

export default mongoose.model('RoleChange', roleChangeSchema);
