import PasswordResetToken from './password-reset-token.model.js';

export async function create(data) {
    return PasswordResetToken.create(data);
}

export async function invalidateActiveForUser(userId) {
    return PasswordResetToken.deleteMany({ userId, usedAt: null });
}

export async function consume(tokenHash, now) {
    return PasswordResetToken.findOneAndUpdate(
        { tokenHash, usedAt: null, expiresAt: { $gt: now } },
        { $set: { usedAt: now } },
        { returnDocument: 'after' },
    ).lean();
}