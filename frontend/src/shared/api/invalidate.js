export function invalidateResource(queryClient, ...resourcePaths) {
  return queryClient.invalidateQueries({
    predicate: ({ queryKey }) => {
      const path = queryKey[0];
      return (
        typeof path === 'string' &&
        resourcePaths.some(
          (resource) => path === resource || path.startsWith(`${resource}/`)
        )
      );
    },
  });
}
