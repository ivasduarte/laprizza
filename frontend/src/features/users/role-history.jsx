import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { usersApi } from './users.api.js';
import { getUsersErrorKey, roleLabel } from './users.utils.js';

/** AA06: who assigned or removed each role, and when. */
export default function RoleHistory({ userId, emailById }) {
  const { t, i18n } = useTranslation();
  const history = useQuery({
    queryKey: ['users', 'role-history', userId],
    queryFn: ({ signal }) => usersApi.roleHistory(userId, signal),
  });

  if (history.isPending)
    return <p role="status">{t('users.history.loading')}</p>;
  if (history.isError) {
    return (
      <p className="message message-error" role="alert">
        {t(getUsersErrorKey(history.error))}
      </p>
    );
  }
  if (history.data.length === 0) {
    return <p className="message">{t('users.history.empty')}</p>;
  }

  const actorText = (actor) =>
    actor?.kind === 'USER'
      ? (emailById.get(actor.userId) ?? actor.userId)
      : t(`users.history.process.${actor?.process}`, {
          defaultValue: actor?.process ?? '-',
        });

  return (
    <table className="users-history">
      <caption>{t('users.history.title')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('users.history.when')}</th>
          <th scope="col">{t('users.history.change')}</th>
          <th scope="col">{t('users.history.by')}</th>
        </tr>
      </thead>
      <tbody>
        {history.data.map((change, index) => (
          <tr key={`${change.at}-${change.role}-${index}`}>
            <td>{new Date(change.at).toLocaleString(i18n.language)}</td>
            <td>
              {t(
                change.action === 'REMOVED'
                  ? 'users.history.removed'
                  : 'users.history.assigned',
                { role: roleLabel(t, change.role) }
              )}
            </td>
            <td>{actorText(change.actor)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
