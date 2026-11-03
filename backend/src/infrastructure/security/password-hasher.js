import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

export const ARGON2_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
});

export function createPasswordHasher(options = ARGON2_OPTIONS) {
  let dummyHashPromise;
  const dummyHash = () =>
    (dummyHashPromise ??= argon2.hash(randomBytes(32).toString('hex'), options));

  async function verifyDummy(plain) {
    await argon2.verify(await dummyHash(), plain).catch(() => false);
    return false;
  }

  return {
    hash: (plain) => argon2.hash(plain, options),
    async verify(hash, plain) {
      if (!hash) return verifyDummy(plain);
      try {
        return await argon2.verify(hash, plain);
      } catch {
        return false;
      }
    },
    verifyDummy,
    needsRehash: (hash) => argon2.needsRehash(hash, options),
    warmUp: () => dummyHash(),
  };
}

export const passwordHasher = createPasswordHasher();