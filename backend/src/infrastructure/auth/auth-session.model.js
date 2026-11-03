import mongoose from 'mongoose';

const authSessionSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true, index: true },
        refreshTokenHash: { type: String, required: true, unique: true },
        // Hashes already rotated: used to detect reuse (token theft).
        rotatedHashes: { type: [String], default: [], index: true },
        tokenVersion: { type: Number, required: true },
        createdAt: { type: Date, required: true },
        lastUsedAt: { type: Date, required: true },
        expiresAt: { type: Date, required: true },
        revokedAt: { type: Date, default: null },
        userAgent: { type: String, maxLength: 256 },
        ip: { type: String, maxLength: 64 },
    },
    { collection: 'Auth Sessions', versionKey: false },
);

authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('AuthSession', authSessionSchema);