import { useId, useState } from "react";
import type { User } from "@/types";
import { InputPrimitive } from "@/components/InputPrimitive";
import { SelectPrimitive } from "@/components/SelectPrimitive";
import { ToolkitButton } from "@/components/ToolkitButton";
import ToolkitContainer from "@/components/ToolkitContainer";
import { QueryStatus } from "@/components/QueryStatus";
import { useSaveUser } from "@/queries/toolkit";
import WeightMeasureModal from "./WeightMeasureModal";
import { formatWeight, unitToKg } from "@/utils/weight";

const genders = ["Male", "Female", "Non-binary", "Prefer not to say"];
const genderOptions = [...genders, "Other"].map((value) => ({ value, label: value }));
const colors = ["#e55d82", "#409edb", "#e8bd00", "#894c2f", "#dd2020", "#2a2a2a", "#989898", "#9bbc0f"];
const options = (values: string[]) => values.map((value) => ({ value, label: value }));

export default function UserEditor({
  user,
  initialEditing,
  onEditingChange,
  onSavingChange,
  onDelete,
  sessionDevices,
  disabled,
}: {
  user: User;
  initialEditing: boolean;
  onEditingChange: (editing: boolean) => void;
  onSavingChange: (saving: boolean) => void;
  onDelete: () => void;
  sessionDevices: Array<{ name: string; macAddress: number }>;
  disabled: boolean;
}) {
  const fieldId = useId();
  const [draft, setDraft] = useState<User | null>(initialEditing ? { ...user } : null);
  const [genderChoice, setGenderChoice] = useState(
    user.gender == null ? "" : genders.includes(user.gender) ? user.gender : "Other",
  );
  // Weight is stored in kilograms; the input shows it in the chosen unit. Typing keeps its own
  // text so the stored value does not round the field under the user.
  const [weightText, setWeightText] = useState(() => formatWeight(user.weight, user.weightMetric ?? "kg"));
  const [measuring, setMeasuring] = useState(false);
  const save = useSaveUser();
  const displayed = draft ?? user;
  const editing = draft !== null;
  const locked = disabled || save.isPending;
  const update = <K extends keyof User>(key: K, value: User[K]) =>
    setDraft((previous) => (previous ? { ...previous, [key]: value } : previous));
  const finish = () => {
    setDraft(null);
    setMeasuring(false);
    onEditingChange(false);
    save.reset();
  };
  const start = () => {
    setDraft({ ...user });
    setWeightText(formatWeight(user.weight, user.weightMetric ?? "kg"));
    setGenderChoice(user.gender == null ? "" : genders.includes(user.gender) ? user.gender : "Other");
    onEditingChange(true);
  };
  const choice = editing
    ? genderChoice
    : displayed.gender == null
      ? ""
      : genders.includes(displayed.gender)
        ? displayed.gender
        : "Other";
  return (
    <ToolkitContainer className="p-8">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!draft || locked) return;
          onSavingChange(true);
          try {
            await save.mutateAsync({ ...draft, name: draft.name.trim() });
            finish();
          } catch {
            /* Mutation error is shown below. */
          } finally {
            onSavingChange(false);
          }
        }}
      >
        <header className="mb-5 flex items-center justify-between border-b border-gray-300 pb-3">
          <div>
            <h2 className="font-bold">{user.name}</h2>
            <p className="text-sm text-gray-600">
              Created {new Date(user.createdAt).toLocaleDateString()} · Updated{" "}
              {new Date(user.updatedAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <ToolkitButton type="submit" color="blue" disabled={locked || !draft.name.trim()}>
                  {save.isPending ? "Saving…" : "Save"}
                </ToolkitButton>
                <ToolkitButton type="button" color="grey" disabled={locked} onClick={finish}>
                  Cancel
                </ToolkitButton>
              </>
            ) : (
              <ToolkitButton type="button" color="blue" disabled={locked} onClick={start}>
                Edit
              </ToolkitButton>
            )}
            {!user.isDefault && (
              <ToolkitButton type="button" color="red" disabled={locked} onClick={onDelete}>
                Delete
              </ToolkitButton>
            )}
          </div>
        </header>
        <QueryStatus error={save.error} />
        <fieldset disabled={!editing || locked} className="grid min-w-0 grid-cols-4 items-start gap-x-6 gap-y-5">
          <label className="user-editor-field">
            <span>Name</span>
            <InputPrimitive
              className="w-full min-w-0"
              required
              value={displayed.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </label>
          <label className="user-editor-field">
            <span>Age</span>
            <InputPrimitive
              className="w-full min-w-0"
              type="number"
              min={0}
              max={150}
              step={1}
              value={displayed.age ?? ""}
              onChange={(e) => update("age", e.target.value === "" ? null : Number(e.target.value))}
            />
          </label>
          <div className="user-editor-field">
            <span id={`${fieldId}-gender`}>Gender</span>
            <SelectPrimitive
              aria-labelledby={`${fieldId}-gender`}
              value={choice}
              noneOption="Not specified"
              options={genderOptions}
              disabled={!editing || locked}
              onChange={(value) => {
                setGenderChoice(value ?? "");
                update("gender", value === "Other" ? "" : (value ?? null));
              }}
            />
            {choice === "Other" && (
              <label className="user-editor-field">
                <span>Specify gender</span>
                <InputPrimitive
                  className="w-full min-w-0"
                  value={displayed.gender ?? ""}
                  onChange={(e) => update("gender", e.target.value)}
                />
              </label>
            )}
          </div>
          <div className="user-editor-field">
            <label htmlFor={`${fieldId}-height`}>Height</label>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_4rem] items-center gap-2">
              <InputPrimitive
                id={`${fieldId}-height`}
                className="w-full min-w-0"
                aria-label="Height"
                type="number"
                min={0}
                step="any"
                value={displayed.height ?? ""}
                onChange={(e) => update("height", e.target.value === "" ? null : Number(e.target.value))}
              />
              <SelectPrimitive
                aria-label="Height unit"
                value={displayed.heightMetric ?? "cm"}
                options={options(["cm", "in"])}
                disabled={!editing || locked}
                onChange={(value) => update("heightMetric", value)}
              />
            </div>
          </div>
          <div className="user-editor-field">
            <label htmlFor={`${fieldId}-weight`}>Weight</label>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_4rem_auto] items-center gap-2">
              <InputPrimitive
                id={`${fieldId}-weight`}
                className="w-full min-w-0"
                aria-label="Weight"
                required
                type="number"
                min={0.01}
                step="any"
                value={editing ? weightText : formatWeight(displayed.weight, displayed.weightMetric ?? "kg")}
                onChange={(e) => {
                  setWeightText(e.target.value);
                  update(
                    "weight",
                    e.target.value === "" ? null : unitToKg(Number(e.target.value), displayed.weightMetric ?? "kg"),
                  );
                }}
              />
              <SelectPrimitive
                aria-label="Weight unit"
                value={displayed.weightMetric ?? "kg"}
                options={options(["kg", "lb"])}
                disabled={!editing || locked}
                onChange={(value) => {
                  update("weightMetric", value);
                  setWeightText(formatWeight(displayed.weight, value));
                }}
              />
              <ToolkitButton
                type="button"
                size="none"
                className="h-8 px-3 whitespace-nowrap"
                color="blue"
                onClick={() => setMeasuring(true)}
              >
                Measure
              </ToolkitButton>
            </div>
          </div>
          <div className="user-editor-field">
            <span id={`${fieldId}-hand`}>Dominant hand</span>
            <SelectPrimitive
              aria-labelledby={`${fieldId}-hand`}
              value={displayed.dominantHand ?? undefined}
              noneOption="Not specified"
              options={options(["Right", "Left", "Ambidextrous"])}
              disabled={!editing || locked}
              onChange={(value) => update("dominantHand", value ?? null)}
            />
          </div>
          <div className="user-editor-field col-span-2">
            <span>Color</span>
            <div className="flex min-h-8 flex-wrap items-center gap-2" role="group" aria-label="User color">
              {colors.map((color) => (
                <button
                  type="button"
                  key={color}
                  aria-label={color}
                  aria-pressed={displayed.color === color}
                  onClick={() => update("color", color)}
                  className="size-6 rounded border border-gray-300 aria-pressed:ring-2 aria-pressed:ring-blue-700 aria-pressed:ring-offset-2"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </fieldset>
      </form>
      {measuring && (
        <WeightMeasureModal
          sessionDevices={sessionDevices}
          weightMetric={displayed.weightMetric ?? "kg"}
          onClose={() => setMeasuring(false)}
          onSave={(weightKg) => {
            update("weight", weightKg);
            setWeightText(formatWeight(weightKg, displayed.weightMetric ?? "kg"));
            setMeasuring(false);
          }}
        />
      )}
    </ToolkitContainer>
  );
}
