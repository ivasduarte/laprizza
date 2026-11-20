import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import RoleHistory from './role-history.jsx';
import { roleLabel, rolesToAdd, statusKey } from './users.utils.js';

/**
 * One account of the administration list. Controls follow the permissions of the session;
 * the back end checks them again (and refuses changes to one's own account).
 */
export default function UserRow({
  user,
  isSelf,
  assignableRoles,
  can,
  busy,
  emailById,
  onAddRole,
  onRemoveRole,
  onSetActive,
  onReissue,
}) {
  const { t } = useTranslation();
  const [roleToAdd, setRoleToAdd] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [pending, setPending] = useState(null); // confirmation: { kind, role? }

  const addable = isSelf ? [] : rolesToAdd(user, assignableRoles);
  const removable = (role) => !isSelf && assignableRoles.includes(role);
  const label = user.username ? `${user.email} (${user.username})` : user.email;

  function confirm() {
    const action = pending;
    setPending(null);
    if (action.kind === 'remove') onRemoveRole(user, action.role);
    if (action.kind === 'disable') onSetActive(user, false);
  }

  return (
    <Fragment>
      <tr>
        <td>
          {user.email}
          {user.username && <div className="users-hint">{user.username}</div>}
          {isSelf && <div className="users-hint">{t('users.you')}</div>}
        </td>
        <td>
          <ul className="users-chips">
            {user.roles.length === 0 && <li>{t('users.noRoles')}</li>}
            {user.roles.map((role) => (
              <li key={role} className="users-chip">
                {roleLabel(t, role)}
                {removable(role) && (
                  <button
                    type="button"
                    className="users-chip-remove"
                    onClick={() => setPending({ kind: 'remove', role })}
                    disabled={busy}
                    aria-label={t('users.removeRoleFrom', {
                      role: roleLabel(t, role),
                      user: label,
                    })}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
          {addable.length > 0 && (
            <div className="users-row">
              <label
                className="visually-hidden"
                htmlFor={`add-role-${user.id}`}
              >
                {t('users.addRoleTo', { user: label })}
              </label>
              <select
                id={`add-role-${user.id}`}
                value={roleToAdd}
                onChange={(e) => setRoleToAdd(e.target.value)}
                disabled={busy}
              >
                <option value="">{t('users.chooseRole')}</option>
                {addable.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(t, role)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary small"
                disabled={busy || !roleToAdd}
                onClick={() => {
                  onAddRole(user, roleToAdd);
                  setRoleToAdd('');
                }}
              >
                {t('users.addRole')}
              </button>
            </div>
          )}
        </td>
        <td>{t(statusKey(user))}</td>
        <td>
          <div className="users-row">
            {can.invite && user.pendingActivation && (
              <button
                type="button"
                className="secondary small"
                disabled={busy}
                onClick={() => onReissue(user)}
              >
                {t('users.reissue')}
              </button>
            )}
            {can.manage && !isSelf && user.status === 'active' && (
              <button
                type="button"
                className="danger small"
                disabled={busy}
                onClick={() => setPending({ kind: 'disable' })}
              >
                {t('users.disable')}
              </button>
            )}
            {can.manage && !isSelf && user.status === 'disabled' && (
              <button
                type="button"
                className="secondary small"
                disabled={busy}
                onClick={() => onSetActive(user, true)}
              >
                {t('users.enable')}
              </button>
            )}
            <button
              type="button"
              className="secondary small"
              aria-expanded={showHistory}
              onClick={() => setShowHistory((open) => !open)}
            >
              {showHistory ? t('users.hideHistory') : t('users.showHistory')}
            </button>
          </div>
        </td>
      </tr>

      {pending && (
        <tr>
          <td colSpan={4}>
            <div className="message message-warning" role="alert">
              <strong>
                {pending.kind === 'disable'
                  ? t('users.confirmDisable', { user: label })
                  : t('users.confirmRemoveRole', {
                      role: roleLabel(t, pending.role),
                      user: label,
                    })}
              </strong>
              <div className="users-row">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setPending(null)}
                >
                  {t('users.cancel')}
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={busy}
                  onClick={confirm}
                >
                  {t('users.confirm')}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}

      {showHistory && (
        <tr>
          <td colSpan={4}>
            <RoleHistory userId={user.id} emailById={emailById} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}
