import { useQuery } from "@tanstack/react-query";
import { NumberField } from "@/components/NumberField";
import { SelectPrimitive } from "@/components/SelectPrimitive.tsx";
import { SingleColumn } from "@/components/SingleColumn.tsx";
import { Checkbox } from "@/components/Checkbox.tsx";
import { GeneralSettings, InterpolationSetting, interpolationOptions, SessionSettings } from "@/types.ts";
import type { TooltipDetail } from "@/components/Tooltip.tsx";
import { SettingsQuery } from "@/queries/toolkit";
import { LSL_PROCESSED_SUFFIX, LSL_RAW_SUFFIX } from "@/bindings";

export type ProcessingValues = Pick<
  SessionSettings,
  "windowSizeMs" | "windowSlideMs" | "samplingRate" | "interpolation" | "lslEnabled" | "tcpEnabled"
>;

type FieldsProps = {
  value: ProcessingValues | null;
  disabled: boolean;
  /** Resolves when the backend has accepted the value. The owner's mutation renders failures. */
  onChange: <K extends keyof ProcessingValues>(key: K, next: SessionSettings[K]) => Promise<unknown>;
};

// Fire-and-forget for controls that have no draft of their own; the owning mutation
// exposes the error, so a rejection here has already been reported.
const fire = (promise: Promise<unknown>) => void promise.catch(() => undefined);

/** Window, slide, sampling rate and interpolation. Rendered inside the settings grid. */
export function ProcessingFields({
  value,
  disabled,
  onChange,
  onDraftChange,
}: FieldsProps & { onDraftChange: (field: string, dirty: boolean) => void }) {
  const numberField = (key: "windowSizeMs" | "windowSlideMs" | "samplingRate", label: string) => (
    <NumberField
      disabled={disabled}
      label={label}
      value={value?.[key]}
      onCommit={(next) => onChange(key, next)}
      onDraftChange={(dirty) => onDraftChange(key, dirty)}
    />
  );
  return (
    <>
      <SingleColumn label="Window Size (ms)" className="col-span-6" tooltipId="session_window_size">
        {numberField("windowSizeMs", "Window size in milliseconds")}
      </SingleColumn>
      <SingleColumn label="Window Slide (ms)" className="col-span-6" tooltipId="session_window_slide">
        {numberField("windowSlideMs", "Window slide in milliseconds")}
      </SingleColumn>
      <SingleColumn label="Sampling Rate" className="col-span-5" tooltipId="session_sampling_rate">
        {numberField("samplingRate", "Sampling rate")}
      </SingleColumn>
      <SingleColumn label="Interpolation" className="col-span-5" tooltipId="session_interpolation">
        <SelectPrimitive<InterpolationSetting>
          disabled={disabled}
          value={value?.interpolation ?? "Linear"}
          onChange={(v) => fire(onChange("interpolation", v))}
          options={interpolationOptions.map((i) => ({ label: i, value: i }))}
        />
      </SingleColumn>
    </>
  );
}

// What each stream is called, or where it listens, as set in Settings. The LSL suffixes come from
// the backend, so these are the names the streams really use.
function lslDetails(settings: GeneralSettings): TooltipDetail[] {
  const stream = (sending: boolean, kind: string, suffix: string) =>
    sending
      ? [
          { label: `${kind} stream`, value: `${settings.lslStreamName}${suffix}` },
          { label: `${kind} source ID`, value: `${settings.lslSourceId}${suffix}` },
        ]
      : [{ label: `${kind} stream`, value: "Off" }];
  return [
    ...stream(settings.lslSendRawData, "Raw", LSL_RAW_SUFFIX),
    ...stream(settings.lslSendProcessedData, "Processed", LSL_PROCESSED_SUFFIX),
  ];
}

function tcpDetails(settings: GeneralSettings): TooltipDetail[] {
  return [
    { label: "Raw data", value: settings.tcpSendRawData ? settings.tcpConnectionStringRaw : "Off" },
    { label: "Processed data", value: settings.tcpSendProcessedData ? settings.tcpConnectionStringProcessed : "Off" },
  ];
}

/** The LSL and TCP on/off switches. */
export function StreamToggles({ value, disabled, onChange }: FieldsProps) {
  const settings = useQuery(SettingsQuery).data?.loadedSettings;
  const toggle = (
    key: "lslEnabled" | "tcpEnabled",
    label: string,
    tooltipId: string,
    details: TooltipDetail[] | undefined,
  ) => (
    <SingleColumn label={label} direction="row" tooltipId={tooltipId} tooltipDetails={details} className="col-span-4">
      <Checkbox
        disabled={disabled}
        className="ml-2"
        checked={value?.[key] ?? false}
        onChange={(e) => fire(onChange(key, e.target.checked))}
      />
      <span className={`font-semibold ${disabled ? "opacity-60" : ""}`}>{value?.[key] ? "ON" : "OFF"}</span>
    </SingleColumn>
  );
  return (
    <>
      {toggle("lslEnabled", "LSL", "session_lsl_toggle", settings && lslDetails(settings))}
      {toggle("tcpEnabled", "TCP", "session_tcp_toggle", settings && tcpDetails(settings))}
    </>
  );
}

export function DraftNotice({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p role="status" className="text-sm text-gray-600">
      Finish editing the numeric fields before starting. Press Enter or leave a field to save; Escape discards its
      draft.
    </p>
  );
}
