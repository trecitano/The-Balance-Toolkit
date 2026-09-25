export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function QueryStatus({
  pending,
  error,
  onRetry,
  empty,
}: {
  pending?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: string;
}) {
  if (error)
    return (
      <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
        <p>{errorMessage(error)}</p>
        {onRetry && (
          <button type="button" className="mt-2 underline" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  // Queries are local IPC calls that resolve within a few frames, so any visible indicator
  // reads as flicker. Leave the area blank and let the page appear once the data arrives.
  if (pending) return <div aria-busy="true" />;
  if (empty) return <p className="p-4 text-gray-600">{empty}</p>;
  return null;
}
