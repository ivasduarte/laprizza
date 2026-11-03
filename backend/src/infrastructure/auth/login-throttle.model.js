import mongoose from 'mongoose';

const loginThrottleSchema = new mongoose.Schema(
    {
        keyHash: { type: String, required: true, unique: true },
        failedCount: { type: Number, default: 0 },
        lockedUntil: { type: Date, default: null },
        expiresAt: { type: Date, required: true },
    },
    { collection: 'Login Throttles', versionKey: false },
);

loginThrottleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('LoginThrottle', loginThrottleSchema);