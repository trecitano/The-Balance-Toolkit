import { open } from "@tauri-apps/plugin-dialog";
import { MultiSelect } from "@/components/MultiSelect.tsx";

export type SessionPanelValue = {
  user: string;
  lsl: boolean;
  tcp: boolean;
  saveDir: string | null;
  recording: boolean;
};

export function SessionPanel({
  boards,
  users,
  value,
  onChange,
  onRecordToggle,
}: {
  boards: string[];
  users: string;
  value: SessionPanelValue;
  onChange: (v: SessionPanelValue) => void;
  onRecordToggle?: (recording: boolean, state: SessionPanelValue) => void;
}) {
  const update = <K extends keyof SessionPanelValue>(key: K, val: SessionPanelValue[K]) => {
    const next = { ...value, [key]: val };
    onChange(next);
  };

  const pickDirectory = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select save directory",
    });
    if (typeof selected === "string") {
      update("saveDir", selected);
    }
  };

  const toggleRecording = () => {
    const nextRecording = !value.recording;
    const nextState = { ...value, recording: nextRecording };
    onChange(nextState);
    onRecordToggle?.(nextRecording, nextState);
  };

  const selectCls =
    "h-10 w-full rounded-md border border-gray-300 bg-white px-3 pr-8 text-sm " +
    "focus:border-blue-500 focus:outline-none";
  const shellCls =
    "flex h-10 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm";

  return (
    <div className="rounded-xl border bg-white/70 p-3 shadow-sm">
      <h1 className="text-xl font-semibold pb-3">Session</h1>
      <div className="flex flex-wrap items-stretch gap-4">
        {/* Record / Recording button */}
        <button
          type="button"
          onClick={toggleRecording}
          className={`flex items-center w-35 gap-2 rounded-full px-4 py-2.5 text-white shadow transition ${
            value.recording ? "bg-red-700 hover:bg-red-800" : "bg-red-600 hover:bg-red-700"
          }`}
        >
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full bg-white ${
              value.recording ? "animate-pulse" : ""
            }`}
          />
          <span className="font-medium">{value.recording ? "Recording…" : "Record"}</span>
        </button>

        {/* Controls grid */}
        <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-5">
          {/* Board to Display (Multi-select) */}
          <div>
            <MultiSelect
              label="Board to Display"
              options={boards.map((b) => ({ value: b.id, label: b.label }))}
              value={value.boardIds}
              onChange={(ids) => update("boardIds", ids)}
              placeholder="None selected"
            />
          </div>

          {/* User (single select) */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">User</label>
            <select
              className={selectCls}
              value={value.userId ?? ""}
              onChange={(e) => update("userId", e.target.value || null)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* LSL */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">LSL</label>
            <label className={shellCls}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={value.lsl}
                onChange={(e) => update("lsl", e.target.checked)}
              />
              <span>Enabled</span>
            </label>
          </div>

          {/* TCP */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">TCP</label>
            <label className={shellCls}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={value.tcp}
                onChange={(e) => update("tcp", e.target.checked)}
              />
              <span>Enabled</span>
            </label>
          </div>

          {/* Save Location */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">Save Location</label>
            <div className="flex h-10 items-center gap-2">
              <button
                type="button"
                className="h-10 rounded-md border border-gray-300 bg-gray-100 px-3 text-sm hover:bg-gray-200"
                onClick={pickDirectory}
              >
                Choose…
              </button>
              <div className="min-w-0 flex-1 truncate text-sm text-gray-700">
                {value.saveDir ?? "No folder selected"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
