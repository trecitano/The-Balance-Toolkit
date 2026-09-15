import { useId, useState } from "react";
import { InputPrimitive } from "./InputPrimitive";
import { errorMessage } from "./QueryStatus";

/** An empty or invalid draft stays local. Blur/Enter commits; Escape discards. */
export function NumberField({
  value,
  onCommit,
  disabled,
  label,
  onDraftChange,
  min = 1,
}: {
  value: number | undefined;
  onCommit: (value: number) => Promise<unknown>;
  disabled?: boolean;
  label: string;
  min?: number;
  onDraftChange?: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const errorId = useId();
  const discard = () => {
    setDraft(null);
    setError(null);
    onDraftChange?.(false);
  };
  const commit = async () => {
    if (draft === null || saving) return;
    // The field cannot save while disabled; discard the draft rather than leaving it dirty,
    // which would keep the parent's draft gate closed with no way to release it.
    if (disabled) {
      discard();
      return;
    }
    const number = Number(draft);
    if (!draft.trim() || !Number.isSafeInteger(number) || number < min) {
      setError(`Enter a whole number of at least ${min}.`);
      return;
    }
    if (number === value) {
      discard();
      return;
    }
    // Report "clean" as soon as the save starts: the parent gates on its pending save from
    // here on, so the click that blurred this field is not swallowed by the draft gate.
    onDraftChange?.(false);
    setSaving(true);
    try {
      await onCommit(number);
      setDraft(null);
      setError(null);
    } catch (failure) {
      onDraftChange?.(true);
      setError(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div>
      <InputPrimitive
        type="number"
        min={min}
        step={1}
        aria-label={label}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        disabled={disabled || saving}
        value={draft ?? value ?? ""}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
          onDraftChange?.(event.target.value !== String(value ?? ""));
        }}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            discard();
          }
        }}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
