import mongoose from 'mongoose';

const passwordResetTokenSchema = new mongoose.Schema(
    {
        tokenHash: { type: String, required: true, unique: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true, index: true },
        createdAt: { type: Date, required: true },
        expiresAt: { type: Date, required: true },
        usedAt: { type: Date, default: null },
    },
    { collection: 'Password Reset Tokens', versionKey: false },
);

passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('PasswordResetToken', passwordResetTokenSchema);