import mongoose from 'mongoose';
import { Roles, AccountStatus } from '../../domain/users/users.domain.js';

function hideSecrets(_doc, ret) {
  delete ret.passwordHash;
  delete ret.__v;
  return ret;
}

/**
 * Mongoose schema defining the structure of the Users collection in the database.
 * Uses sparse and unique indexes for 'username' and 'email', meaning multiple users
 * can lack a username or an email, but if provided, it must be unique across the collection.
 * The 'password' field is excluded from query results by default (select: false) for security.
 *
 * @type {mongoose.Schema}
 */
const userSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
    email: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
    passwordHash: { type: String, select: false },
    role: { type: String, enum: Object.values(Roles), required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customers', required: false },
    status: {
      type: String,
      enum: Object.values(AccountStatus),
      required: true,
      default: AccountStatus.INACTIVE,
    },
    failedLoginCount: { type: Number, default: 0, min: 0 },
    lockedUntil: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0, min: 0 },
  },
  { toJSON: { transform: hideSecrets }, toObject: { transform: hideSecrets } },
);

/**
 * Pre-validate middleware hook for the user schema.
 * Enforces the business rule that a user document cannot be saved without at least one valid identifier.
 *
 * @throws {Error} Throws an error if both 'username' and 'email' are missing before validation.
 */
userSchema.pre('validate', function () {
  if (this.isNew && !this.email) throw new Error('A user must have an email.');
});

/**
 * Compiled Mongoose model for the Users collection.
 * @type {mongoose.Model}
 */
export default mongoose.model('Users', userSchema);
