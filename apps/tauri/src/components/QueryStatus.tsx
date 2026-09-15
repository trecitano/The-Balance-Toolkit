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
  if (pending)
    return (
      <p role="status" className="p-4 text-gray-600">
        Loading…
      </p>
    );
  if (empty) return <p className="p-4 text-gray-600">{empty}</p>;
  return null;
}
