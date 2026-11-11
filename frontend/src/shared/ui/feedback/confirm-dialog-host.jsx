import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { confirmStore } from '../../feedback/confirm-store.js';
import { useConfirmState } from '../../feedback/use-feedback.js';
import './feedback.css';

/**
 * Renders the dialog requested through `useConfirm()`. Uses the native <dialog>:
 * focus trap, Esc to cancel and focus return come from the browser. Cancel is first in the DOM,
 * so it receives the initial focus (a destructive action is never the default).
 */
export default function ConfirmDialogHost() {
  const { t } = useTranslation();
  const { current } = useConfirmState();
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (current && !dialog.open) dialog.showModal();
    if (!current && dialog.open) dialog.close();
  }, [current]);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      onCancel={(event) => {
        event.preventDefault();
        confirmStore.cancel();
      }}
    >
      {current && (
        <div className="confirm-dialog-body">
          <h2 id="confirm-dialog-title">
            {t(current.titleKey ?? 'feedback.confirm.title')}
          </h2>
          <p id="confirm-dialog-message">
            {t(current.messageKey, current.params)}
          </p>
          <div className="confirm-dialog-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => confirmStore.cancel()}
            >
              {t(current.cancelKey ?? 'feedback.confirm.cancel')}
            </button>
            <button
              type="button"
              className={current.tone === 'danger' ? 'danger' : undefined}
              onClick={() => confirmStore.confirm()}
            >
              {t(current.confirmKey ?? 'feedback.confirm.confirm')}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
