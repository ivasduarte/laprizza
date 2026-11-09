import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../shared/auth/use-session.js';
import { sharedResourcesApi } from './shared-resources.api.js';
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  formatSize,
  getSharedResourcesErrorKey,
  validateUpload,
} from './shared-resources.utils.js';
import './shared-resources-page.css';

export default function SharedResourcesPage() {
  const { t, i18n } = useTranslation();
  const { status, user } = useSession();
  const authenticated = status === 'authenticated';
  const queryClient = useQueryClient();
  const canManage = user?.role === 'MANAGER';
  const queryKey = ['shared-resources', user?.id ?? user?.userId];

  const [message, setMessage] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadName, setUploadName] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const fileInput = useRef(null);

  const resources = useQuery({
    queryKey,
    queryFn: ({ signal }) => sharedResourcesApi.list(signal),
    enabled: authenticated,
  });
  const files = resources.data ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const showError = (err) =>
    setMessage({ type: 'error', text: t(getSharedResourcesErrorKey(err)) });

  const upload = useMutation({
    mutationFn: ({ name, file }) => sharedResourcesApi.upload(name, file),
    onSuccess: (result, { name }) => {
      setSelectedFile(null);
      setUploadName('');
      if (fileInput.current) fileInput.current.value = '';
      setMessage({
        type: 'success',
        text: t(
          result === 'created'
            ? 'sharedResources.uploaded'
            : 'sharedResources.replaced',
          {
            name,
          }
        ),
      });
      refresh();
    },
    onError: showError,
  });

  const download = useMutation({
    mutationFn: (name) => sharedResourcesApi.download(name),
    onSuccess: (blob, name) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: showError,
  });

  const remove = useMutation({
    mutationFn: (name) => sharedResourcesApi.remove(name),
    onSuccess: (_, name) => {
      setMessage({
        type: 'success',
        text: t('sharedResources.deleted', { name }),
      });
      refresh();
    },
    onError: (err) => {
      showError(err);
      if (err.status === 404) refresh();
    },
  });

  const busy = upload.isPending || download.isPending || remove.isPending;
  const loadError = resources.isError
    ? getSharedResourcesErrorKey(resources.error)
    : null;

  function handleFileChange(event) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadName(file ? file.name : '');
    setFieldError(null);
  }

  function handleUpload(event) {
    event.preventDefault();
    if (busy) return;
    const name = uploadName.trim();
    const key = validateUpload(name, selectedFile);
    if (key) {
      setFieldError(key);
      return;
    }
    setFieldError(null);
    setMessage(null);
    upload.mutate({ name, file: selectedFile });
  }

  function handleDownload(name) {
    setMessage(null);
    download.mutate(name);
  }

  function handleDelete(name) {
    setPendingDelete(null);
    setMessage(null);
    remove.mutate(name);
  }

  const trimmedName = uploadName.trim();
  const willReplace =
    canManage &&
    trimmedName !== '' &&
    files.some((f) => f.name === trimmedName.normalize('NFC'));

  if (status === 'unknown' || status === 'loading') {
    return <p role="status">{t('layout.loading')}</p>;
  }

  if (!authenticated) {
    return (
      <div className="sr-page">
        <h1>{t('sharedResources.title')}</h1>
        <p className="message message-error" role="alert">
          {t('sharedResources.unauthorized')}
        </p>
        <p>
          <Link to="/login">{t('nav.login')}</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="sr-page">
      <h1>{t('sharedResources.title')}</h1>
      <p>{t('sharedResources.intro')}</p>
      {!canManage && <p className="message">{t('sharedResources.readOnly')}</p>}

      {message && (
        <p
          className={`message message-${message.type}`}
          role={message.type === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}

      <div className="sr-card" aria-busy={resources.isFetching}>
        <div className="sr-row">
          <h2>{t('sharedResources.listTitle')}</h2>
          <button
            type="button"
            className="secondary small"
            onClick={() => resources.refetch()}
            disabled={resources.isFetching || busy}
          >
            {t('sharedResources.refresh')}
          </button>
        </div>

        {resources.isPending && (
          <p role="status">{t('sharedResources.loading')}</p>
        )}

        {loadError && (
          <div className="message message-error" role="alert">
            {t(loadError)}{' '}
            <button
              type="button"
              className="secondary small"
              onClick={() => resources.refetch()}
            >
              {t('sharedResources.retry')}
            </button>
          </div>
        )}

        {resources.isSuccess && files.length === 0 && (
          <p className="message">{t('sharedResources.empty')}</p>
        )}

        {resources.isSuccess && files.length > 0 && (
          <div className="sr-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('sharedResources.col.name')}</th>
                  <th scope="col">{t('sharedResources.col.size')}</th>
                  <th scope="col">{t('sharedResources.col.updated')}</th>
                  <th scope="col">{t('sharedResources.col.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.name}>
                    <td>{file.name}</td>
                    <td>{formatSize(file.size)}</td>
                    <td>
                      {new Date(file.updatedAt).toLocaleString(i18n.language)}
                    </td>
                    <td>
                      <div className="sr-row">
                        <button
                          type="button"
                          className="secondary small"
                          onClick={() => handleDownload(file.name)}
                          disabled={busy}
                          aria-label={t('sharedResources.downloadFile', {
                            name: file.name,
                          })}
                        >
                          {t('sharedResources.download')}
                        </button>
                        {canManage && (
                          <button
                            type="button"
                            className="danger small"
                            onClick={() => setPendingDelete(file.name)}
                            disabled={busy}
                            aria-label={t('sharedResources.deleteFile', {
                              name: file.name,
                            })}
                          >
                            {t('sharedResources.delete')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pendingDelete && (
          <div className="message message-warning" role="alert">
            <strong>
              {t('sharedResources.confirmDelete', { name: pendingDelete })}
            </strong>
            <div className="sr-row" style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className="secondary"
                onClick={() => setPendingDelete(null)}
              >
                {t('sharedResources.cancel')}
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => handleDelete(pendingDelete)}
                disabled={busy}
              >
                {t('sharedResources.confirmDeleteButton')}
              </button>
            </div>
          </div>
        )}
      </div>

      {canManage && (
        <form className="sr-card" onSubmit={handleUpload} noValidate>
          <h2>{t('sharedResources.uploadTitle')}</h2>
          <p className="message message-warning">
            {t('sharedResources.noPersonalData')}
          </p>
          <p>
            {t('sharedResources.allowed', {
              types: ALLOWED_EXTENSIONS.join(', '),
              max: formatSize(MAX_FILE_SIZE),
            })}
          </p>

          <div className="sr-grid">
            <div>
              <label htmlFor="sr-file">{t('sharedResources.file')}</label>
              <input
                id="sr-file"
                ref={fileInput}
                type="file"
                accept={ALLOWED_EXTENSIONS.join(',')}
                onChange={handleFileChange}
                aria-invalid={fieldError ? 'true' : undefined}
                aria-describedby={fieldError ? 'sr-error' : undefined}
              />
            </div>
            <div>
              <label htmlFor="sr-name">{t('sharedResources.fileName')}</label>
              <input
                id="sr-name"
                type="text"
                value={uploadName}
                onChange={(e) => {
                  setUploadName(e.target.value);
                  setFieldError(null);
                }}
                aria-invalid={fieldError ? 'true' : undefined}
                aria-describedby={fieldError ? 'sr-error' : undefined}
              />
            </div>
          </div>

          {fieldError && (
            <p className="sr-field-error" id="sr-error" role="alert">
              {t(fieldError)}
            </p>
          )}
          {willReplace && (
            <p className="message message-warning">
              {t('sharedResources.replaceWarning')}
            </p>
          )}

          <div className="sr-row" style={{ marginTop: '1rem' }}>
            <button type="submit" disabled={busy}>
              {upload.isPending
                ? t('sharedResources.working')
                : willReplace
                  ? t('sharedResources.replace')
                  : t('sharedResources.upload')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
