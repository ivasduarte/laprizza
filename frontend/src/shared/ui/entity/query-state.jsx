import { useTranslation } from 'react-i18next';
import { normalizeError } from '../../api/error-normalizer.js';
import { errorMessage } from '../../api/error-text.js';

export default function QueryState({
  query,
  isEmpty = false,
  searchTerm = '',
  emptyText,
  noResultsText,
  unavailableText,
  unavailable = false,
  unavailableAction = null,
  children,
}) {
  const { t } = useTranslation();
  const detailMode = unavailableText !== undefined;

  const showUnavailable = () => (
    <div className="message message-warning entity-actions" role="status">
      <span>{unavailableText}</span>
      {unavailableAction}
    </div>
  );

  if (query.isPending) return <p role="status">{t('layout.loading')}</p>;

  if (query.isError) {
    const error = normalizeError(query.error);
    if (
      detailMode &&
      (error.kind === 'notFound' || error.kind === 'validation')
    ) {
      return showUnavailable();
    }

    const failure = (
      <div className="message message-error entity-actions" role="alert">
        <span>
          {error.global ? t('entity.loadFailed') : errorMessage(t, error)}
        </span>
        {/* Repeating an invalid request (400) would fail the same way. */}
        {error.kind !== 'validation' && (
          <button
            type="button"
            className="secondary small"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            {t('feedback.retry')}
          </button>
        )}
      </div>
    );
    // A failed refresh keeps the last data on screen, below the error.
    if (query.data === undefined) return failure;
    return (
      <>
        {failure}
        {children}
      </>
    );
  }

  if (detailMode && unavailable) return showUnavailable();

  if (isEmpty) {
    return (
      <p className="message" role="status">
        {searchTerm
          ? (noResultsText ?? t('entity.noResults', { term: searchTerm }))
          : (emptyText ?? t('entity.empty'))}
      </p>
    );
  }

  return children;
}