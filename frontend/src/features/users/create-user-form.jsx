import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { roleLabel, validateNewUser } from './users.utils.js';

/**
 * AA06: creation of an inactive account. No password field: the user sets it through the
 * activation invitation (AA07). CUSTOMER is added by the back end (AA03).
 */
export default function CreateUserForm({ assignableRoles, busy, onCreate }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [roles, setRoles] = useState([]);
  const [errors, setErrors] = useState({});

  function toggleRole(role) {
    setRoles((current) =>
      current.includes(role)
        ? current.filter((r) => r !== role)
        : [...current, role]
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const found = validateNewUser({ email, username });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const created = await onCreate({
      email: email.trim(),
      username: username.trim(),
      roles,
    });
    if (created) {
      setEmail('');
      setUsername('');
      setRoles([]);
    }
  }

  return (
    <form className="users-card" onSubmit={handleSubmit} noValidate>
      <h2>{t('users.create.title')}</h2>
      <p>{t('users.create.intro')}</p>

      <div className="users-grid">
        <div>
          <label htmlFor="users-email">{t('users.create.email')}</label>
          <input
            id="users-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={errors.email ? 'true' : undefined}
            aria-describedby={errors.email ? 'users-email-error' : undefined}
            required
          />
          {errors.email && (
            <p className="users-field-error" id="users-email-error">
              {t(errors.email)}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="users-username">{t('users.create.username')}</label>
          <input
            id="users-username"
            type="text"
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-invalid={errors.username ? 'true' : undefined}
            aria-describedby={
              errors.username ? 'users-username-error' : undefined
            }
          />
          {errors.username && (
            <p className="users-field-error" id="users-username-error">
              {t(errors.username)}
            </p>
          )}
        </div>
      </div>

      <fieldset className="users-roles">
        <legend>{t('users.create.roles')}</legend>
        <p className="users-hint">{t('users.create.customerHint')}</p>
        {assignableRoles.map((role) => (
          <label key={role} className="users-check">
            <input
              type="checkbox"
              checked={roles.includes(role)}
              onChange={() => toggleRole(role)}
            />
            {roleLabel(t, role)}
          </label>
        ))}
      </fieldset>

      <div className="users-row">
        <button type="submit" disabled={busy}>
          {busy ? t('users.working') : t('users.create.submit')}
        </button>
      </div>
    </form>
  );
}
