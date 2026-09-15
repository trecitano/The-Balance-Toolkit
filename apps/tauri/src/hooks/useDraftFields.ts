import { useState } from "react";

/** Tracks which numeric fields hold an uncommitted draft; a session cannot start while any do. */
export function useDraftFields() {
  const [fields, setFields] = useState<string[]>([]);
  return {
    hasDrafts: fields.length > 0,
    onDraftChange: (field: string, dirty: boolean) =>
      setFields((previous) => {
        const rest = previous.filter((item) => item !== field);
        return dirty ? [...rest, field] : rest;
      }),
    clearDrafts: () => setFields([]),
  };
}
