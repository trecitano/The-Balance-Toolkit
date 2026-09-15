import { useMutation } from "@tanstack/react-query";

/**
 * The one idiom for "run this async UI action": `run` performs it, `isPending` disables
 * controls while it is in flight, and `error` feeds a `QueryStatus`. Callers refresh the
 * caches an action touches in `onSuccess`.
 */
export function useAction(onSuccess?: () => Promise<unknown> | void) {
  const mutation = useMutation({
    mutationFn: (perform: () => Promise<unknown>) => perform(),
    onSuccess: () => onSuccess?.(),
  });
  return {
    run: (perform: () => Promise<unknown>) => mutation.mutate(perform),
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
