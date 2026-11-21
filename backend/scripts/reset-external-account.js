/**
 * Development only (AA02/AA06/AA07): removes an account created by an external login, so the
 * first external login, the activation invitation and the external activation can be tried
 * again with the same provider account (only accounts registered as testers can use the
 * Google client in development).
 *
 *   npm run reset:external-account -- --email <email> [--confirm] [--allow-remote]
 *
 * - Without --confirm it only shows what would be removed.
 * - Refuses NODE_ENV=production, and remote databases unless --allow-remote is given.
 * - Only removes accounts with a linked external identity: local accounts are never touched.
 * - Removes the account and everything linked to it: external identities, activation
 *   invitations, role change records, sessions and password reset tokens.
 */
import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import { connectDB } from '../src/infrastructure/database.js';
import Users from '../src/infrastructure/users/users.model.js';
import RoleChange from '../src/infrastructure/users/role-change.model.js';
import ExternalIdentity from '../src/infrastructure/auth/external-identity.model.js';
import ActivationInvitation from '../src/infrastructure/auth/activation-invitation.model.js';
import AuthSession from '../src/infrastructure/auth/auth-session.model.js';
import PasswordResetToken from '../src/infrastructure/auth/password-reset-token.model.js';
import { normalizeEmail } from '../src/domain/users/users.domain.js';
import { describeTarget } from './seed-dev-users.js';

export class ResetError extends Error {}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|mongo)(:\d+)?$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hostsOf = (uri) =>
  String(uri)
    .replace(/^mongodb(\+srv)?:\/\//, '')
    .replace(/^[^@/]*@/, '')
    .split(/[/?]/)[0]
    .split(',');

/** Reads `--email x` or `--email=x`. */
export function emailFromArgs(argv = []) {
  const index = argv.findIndex((arg) => arg === '--email' || arg.startsWith('--email='));
  if (index === -1) return '';
  const value = argv[index].includes('=')
    ? argv[index].split('=').slice(1).join('=')
    : argv[index + 1];
  return normalizeEmail(value);
}

/**
 * Checks everything before connecting.
 * @returns {{email: string, confirmed: boolean}} confirmed is false for a dry run.
 * @throws {ResetError}
 */
export function checkPreconditions({ nodeEnv, argv = [], uri }) {
  if (nodeEnv === 'production') {
    throw new ResetError('Recusado: NODE_ENV=production. Este script é só para desenvolvimento.');
  }
  if (!uri) throw new ResetError('MONGODB_URI não está definido.');
  const remote = !hostsOf(uri).every((host) => LOCAL_HOST.test(host));
  if (remote && !argv.includes('--allow-remote')) {
    throw new ResetError(
      `Recusado: ${describeTarget(uri)} não é uma base de dados local. ` +
        'Usa --allow-remote só numa base de dados de desenvolvimento que seja tua.',
    );
  }
  const email = emailFromArgs(argv);
  if (!EMAIL.test(email)) {
    throw new ResetError('Indica o email da conta: --email <email>.');
  }
  return { email, confirmed: argv.includes('--confirm') };
}

/**
 * What would be removed for the account. Null when there is no account with that email.
 * @throws {ResetError} If the account has no linked external identity (local account).
 */
async function findTarget(email) {
  const user = await Users.findOne({ email }).lean();
  if (!user) return null;
  const identities = await ExternalIdentity.find({ userId: user._id }).lean();
  if (identities.length === 0) {
    throw new ResetError(
      `Recusado: ${email} não tem identidade externa ligada (é uma conta local). Nada foi apagado.`,
    );
  }
  const byUser = { userId: user._id };
  return {
    user,
    identities,
    counts: {
      'External Identities': identities.length,
      'Activation Invitations': await ActivationInvitation.countDocuments(byUser),
      'Role Changes': await RoleChange.countDocuments(byUser),
      'Auth Sessions': await AuthSession.countDocuments(byUser),
      'Password Reset Tokens': await PasswordResetToken.countDocuments(byUser),
      Users: 1,
    },
  };
}

async function removeTarget({ user }) {
  const byUser = { userId: user._id };
  // Linked records first, the account last: an interrupted run can simply be repeated.
  await ExternalIdentity.deleteMany(byUser);
  await ActivationInvitation.deleteMany(byUser);
  await RoleChange.deleteMany(byUser);
  await AuthSession.deleteMany(byUser);
  await PasswordResetToken.deleteMany(byUser);
  await Users.deleteOne({ _id: user._id });
}

async function main() {
  const uri = process.env.MONGODB_URI;
  const { email, confirmed } = checkPreconditions({
    nodeEnv: process.env.NODE_ENV,
    argv: process.argv,
    uri,
  });

  console.log(`Destino: ${describeTarget(uri)}`);
  await connectDB(uri);
  try {
    const target = await findTarget(email);
    if (!target) {
      console.log(`Não existe nenhuma conta com ${email}. Nada a apagar.`);
      return;
    }
    console.log(
      `Conta ${email} (${target.user.status}, roles: ${target.user.roles.join(', ') || '-'}; ` +
        `${target.identities.map((i) => i.provider).join(', ')})`,
    );
    console.table(target.counts);
    if (!confirmed) {
      const remote = process.argv.includes('--allow-remote') ? ' --allow-remote' : '';
      console.log(
        `Nada foi apagado. Para continuar: npm run reset:external-account -- --email ${email}${remote} --confirm`,
      );
      process.exitCode = 1;
      return;
    }
    await removeTarget(target);
    console.log(
      'Conta externa apagada. O próximo login externo cria-a de novo (inativa, com convite).',
    );
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`Reset da conta externa falhou: ${err.message}`);
    process.exitCode = 1;
  });
}
