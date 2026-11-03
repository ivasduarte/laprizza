import LoginThrottle from './login-throttle.model.js';

export async function findByKey(keyHash) {
    return LoginThrottle.findOne({ keyHash }).lean();
}

export async function registerFailure(keyHash, now, retentionMs) {
    return LoginThrottle.findOneAndUpdate(
        { keyHash },
        { $inc: { failedCount: 1 }, $set: { expiresAt: new Date(now.getTime() + retentionMs) } },
        { upsert: true, returnDocument: 'after' },
    ).lean();
}

export async function extendLockout(keyHash, lockedUntil) {
    return LoginThrottle.updateOne({ keyHash }, { $max: { lockedUntil } });
}