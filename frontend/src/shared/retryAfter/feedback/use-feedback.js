import { useSyncExternalStore } from 'react';
import { feedbackStore } from './feedback-store.js';
import { confirmStore } from './confirm-store.js';

export function useFeedbackState() {
  return useSyncExternalStore(feedbackStore.subscribe, feedbackStore.getState);
}

export function useConfirmState() {
  return useSyncExternalStore(confirmStore.subscribe, confirmStore.getState);
}

/** `const confirm = useConfirm(); if (!(await confirm({ messageKey }))) return;` */
export function useConfirm() {
  return confirmStore.request;
}

/** Success/info/warning toasts: `notify({ type: 'success', messageKey: 'x.saved' })`. */
export function useNotify() {
  return feedbackStore.notify;
}