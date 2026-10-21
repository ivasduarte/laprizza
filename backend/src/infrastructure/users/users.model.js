import mongoose from 'mongoose';
import { Roles } from '../../domain/users/users.domain.js';

/**
 * Mongoose schema defining the structure of the Users collection in the database.
 * Uses sparse and unique indexes for 'username' and 'email', meaning multiple users
 * can lack a username or an email, but if provided, it must be unique across the collection.
 * The 'password' field is excluded from query results by default (select: false) for security.
 *
 * @type {mongoose.Schema}
 */
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
  email: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: Object.values(Roles), required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customers', required: false },
  isActive: { type: Boolean, default: true },
});

/**
 * Pre-validate middleware hook for the user schema.
 * Enforces the business rule that a user document cannot be saved without at least one valid identifier.
 *
 * @throws {Error} Throws an error if both 'username' and 'email' are missing before validation.
 */
userSchema.pre('validate', function () {
  if (!this.username && !this.email) {
    throw new Error('A user must have either a username or an email.');
  }
});

/**
 * Compiled Mongoose model for the Users collection.
 * @type {mongoose.Model}
 */
export default mongoose.model('Users', userSchema);
