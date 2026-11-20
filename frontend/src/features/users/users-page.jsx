import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../shared/auth/use-session.js';
import { usePermissions } from '../../shared/auth/use-can.js';
import { can as hasPermission } from '../../shared/auth/permissions.js';
import { usersApi } from './users.api.js';
import { getUsersErrorKey, roleLabel } from './users.utils.js';
import CreateUserForm from './create-user-form.jsx';
import UserRow from './user-row.jsx';
import './users-page.css';

/**
 * AA06: website user administration (Administrator). Accounts, activation invitations and
 * roles. Every control follows the permissions granted by the back end, never role names.
 */
export default function UsersPage() {
  const { t, i18n } = useTranslation();
  const { user: sessionUser } = useSession();
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const sessionId = sessionUser?.id ?? sessionUser?.userId;

  const can = {
    create: hasPermission(permissions, 'users:create'),
    manage: hasPermission(permissions, 'users:manage'),
    invite: hasPermission(permissions, 'users:invite'),
  };
  const [message, setMessage] = useState(null);

  const usersKey = ['users', 'list', sessionId];
  const users = useQuery({
    queryKey: usersKey,
    queryFn: ({ signal }) => usersApi.list(signal),
  });
  const roles = useQuery({
    queryKey: ['users', 'assignable-roles', sessionId],
    queryFn: ({ signal }) => usersApi.assignableRoles(signal),
  });
  const assignableRoles = roles.data ?? [];

  const emailById = useMemo(
    () => new Map((users.data ?? []).map((u) => [String(u.id), u.email])),
    [users.data]
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['users'] });
  const showError = (err) =>
    setMessage({ type: 'error', text: t(getUsersErrorKey(err)) });
  const formatDate = (value) =>
    value ? new Date(value).toLocaleString(i18n.language) : '';
  const invitationMessage = (email, invitation) =>
    invitation?.sent
      ? {
          type: 'success',
          text: t('users.invitationSent', {
            email,
            date: formatDate(invitation.expiresAt),
          }),
        }
      : { type: 'warning', text: t('users.invitationNotSent', { email }) };

  const create = useMutation({
    mutationFn: (input) => usersApi.create(input),
    onSuccess: (created) => {
      const { text, type } = invitationMessage(
        created.email,
        created.invitation
      );
      setMessage({ type, text: `${t('users.created')} ${text}` });
      refresh();
    },
    onError: showError,
  });
  const setActive = useMutation({
    mutationFn: ({ user, isActive }) => usersApi.setActive(user.id, isActive),
    onSuccess: (updated) => {
      setMessage({
        type: 'success',
        text: t(updated.isActive ? 'users.enabled' : 'users.disabled', {
          user: updated.email,
        }),
      });
      refresh();
    },
    onError: showError,
  });
  const addRole = useMutation({
    mutationFn: ({ user, role }) => usersApi.addRole(user.id, role),
    onSuccess: (updated, { role }) => {
      setMessage({
        type: 'success',
        text: t('users.roleAdded', {
          role: roleLabel(t, role),
          user: updated.email,
        }),
      });
      refresh();
    },
    onError: showError,
  });
  const removeRole = useMutation({
    mutationFn: ({ user, role }) => usersApi.removeRole(user.id, role),
    onSuccess: (updated, { role }) => {
      setMessage({
        type: 'success',
        text: t('users.roleRemoved', {
          role: roleLabel(t, role),
          user: updated.email,
        }),
      });
      refresh();
    },
    onError: showError,
  });
  const reissue = useMutation({
    mutationFn: (user) => usersApi.reissueInvitation(user.id),
    onSuccess: (invitation, user) => {
      setMessage(invitationMessage(user.email, invitation));
      refresh();
    },
    onError: showError,
  });

  const busy =
    create.isPending ||
    setActive.isPending ||
    addRole.isPending ||
    removeRole.isPending ||
    reissue.isPending;

  async function handleCreate(input) {
    setMessage(null);
    try {
      await create.mutateAsync(input);
      return true;
    } catch {
      return false;
    }
  }

  const run = (mutation) => (variables) => {
    setMessage(null);
    mutation.mutate(variables);
  };

  return (
    <div className="users-page">
      <h1>{t('users.title')}</h1>
      <p>{t('users.intro')}</p>

      {message && (
        <p
          className={`message message-${message.type}`}
          role={message.type === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}

      {can.create && (
        <CreateUserForm
          assignableRoles={assignableRoles}
          busy={busy}
          onCreate={handleCreate}
        />
      )}

      <div className="users-card" aria-busy={users.isFetching}>
        <div className="users-row users-heading">
          <h2>{t('users.listTitle')}</h2>
          <button
            type="button"
            className="secondary small"
            onClick={() => users.refetch()}
            disabled={users.isFetching || busy}
          >
            {t('users.refresh')}
          </button>
        </div>

        {users.isPending && <p role="status">{t('users.loading')}</p>}
        {users.isError && (
          <div className="message message-error" role="alert">
            {t(getUsersErrorKey(users.error))}{' '}
            <button
              type="button"
              className="secondary small"
              onClick={() => users.refetch()}
            >
              {t('users.retry')}
            </button>
          </div>
        )}
        {users.isSuccess && users.data.length === 0 && (
          <p className="message">{t('users.empty')}</p>
        )}

        {users.isSuccess && users.data.length > 0 && (
          <div className="users-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('users.col.account')}</th>
                  <th scope="col">{t('users.col.roles')}</th>
                  <th scope="col">{t('users.col.status')}</th>
                  <th scope="col">{t('users.col.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    isSelf={String(user.id) === String(sessionId)}
                    assignableRoles={assignableRoles}
                    can={can}
                    busy={busy}
                    emailById={emailById}
                    onAddRole={(u, role) => run(addRole)({ user: u, role })}
                    onRemoveRole={(u, role) =>
                      run(removeRole)({ user: u, role })
                    }
                    onSetActive={(u, isActive) =>
                      run(setActive)({ user: u, isActive })
                    }
                    onReissue={run(reissue)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="users-hint">{t('users.infrastructureNote')}</p>
    </div>
  );
}
