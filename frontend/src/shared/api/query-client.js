import { QueryClient } from '@tanstack/react-query';

/** Client errors (4xx) are not retried; other failures are retried twice. */
export const shouldRetryQuery = (failureCount, error) =>
  !(error?.status >= 400 && error.status < 500) && failureCount < 2;

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: shouldRetryQuery } },
});
