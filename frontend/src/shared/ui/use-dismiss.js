import { useEffect } from 'react';

/**
 * Closes a popover/menu on Escape or on a pointer press outside `containerRef`.
 * On Escape the focus goes back to `returnFocusRef` (the button that opened it).
 *
 * @param {{ open: boolean, onClose: () => void, containerRef: React.RefObject<HTMLElement>, returnFocusRef?: React.RefObject<HTMLElement> }} options
 */
export function useDismiss({ open, onClose, containerRef, returnFocusRef }) {
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) onClose();
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      onClose();
      returnFocusRef?.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose, containerRef, returnFocusRef]);
}
