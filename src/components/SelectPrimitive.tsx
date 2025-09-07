import React, { useMemo, useRef, useState } from "react";

export type BaseOption<T = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type SingleSelectProps<T> = {
  mode?: "single";
  value: T | null;
  onChange: (next: T) => void;
  placeholder?: string;
  noneOption?: string | false;
};

type MultiSelectProps<T> = {
  mode: "multi";
  value: T[];
  onChange: (next: T[]) => void;
  placeholder?: string;
  noOptionsMessage?: string;
};

type CommonProps<T> = {
  options: BaseOption<T>[];
  className?: string;
  disabled?: boolean;
  maxHeight?: number;
};

function isMulti<T>(props: SelectProps<T>): props is CommonProps<T> & MultiSelectProps<T> {
  return props.mode === "multi";
}

type SelectProps<T> = CommonProps<T> & (SingleSelectProps<T> | MultiSelectProps<T>);

export function SelectPrimitive<T extends React.Key = string>(props: SelectProps<T>) {
  const { options, value, onChange, className = "", disabled = false, maxHeight = 260, mode = "single" } = props;

  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const hasOptions = options.length > 0;
  const isDisabled = disabled || !hasOptions;

  const selectedLabels = useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label]));
    if (isMulti(props)) {
      return props.value.map((v) => map.get(v) ?? String(v));
    } else {
      return props.value ? [map.get(props.value) ?? String(props.value)] : [];
    }
  }, [options, value, mode]);

  const toggleValue = (v: T) => {
    if (mode === "multi") {
      const currentValue = value as T[];
      if (currentValue.includes(v)) {
        (onChange as (next: T[]) => void)(currentValue.filter((x) => x !== v));
      } else {
        (onChange as (next: T[]) => void)([...currentValue, v]);
      }
    } else {
      (onChange as (next: T) => void)(v);
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  const handleBlur: React.FocusEventHandler<HTMLDivElement> = (e) => {
    const next = e.relatedTarget as Node | null;
    const root = rootRef.current;
    if (root && next && root.contains(next)) return;
    setOpen(false);
  };

  const onTriggerKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
    if (isDisabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setActiveIdx(0);
      setOpen(true);
      requestAnimationFrame(() => {
        listRef.current?.focus();
      });
    }
  };

  const onListKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }

    const maxIdx = options.length - 1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, maxIdx));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      const opt = options[activeIdx];
      if (opt && !opt.disabled) {
        toggleValue(opt.value);
      }
    }
  };

  const getDisplayText = () => {
    if (mode === "single") {
      const placeholder = (props as SingleSelectProps<T>).placeholder ?? "Select an option";
      return selectedLabels[0] ?? placeholder;
    } else {
      const placeholder = (props as MultiSelectProps<T>).placeholder ?? "None selected";
      const noOptionsMessage = (props as MultiSelectProps<T>).noOptionsMessage ?? "No options available";

      if (!hasOptions) return noOptionsMessage;
      if (selectedLabels.length === 0) return placeholder;
      if (selectedLabels.length === 1) return selectedLabels[0];
      return `${selectedLabels.length} selected`;
    }
  };

  const displayText = getDisplayText();
  const hasSelection = selectedLabels.length > 0;

  return (
    <div ref={rootRef} className={className} onBlur={handleBlur} tabIndex={1}>
      <div className="relative">
        {/* Trigger */}
        <button
          ref={buttonRef}
          type="button"
          disabled={isDisabled}
          onMouseDown={(e) => {
            e.preventDefault();
            if (isDisabled) return;
            const willOpen = !open;
            setOpen(willOpen);
            if (willOpen) {
              setActiveIdx(0);
              requestAnimationFrame(() => {
                listRef.current?.focus();
              });
            }
          }}
          onKeyDown={onTriggerKeyDown}
          className={`flex h-8 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 text-left text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100/80 ${
            open ? "ring-2 ring-blue-100" : ""
          }`}
        >
          <span
            className={`truncate ${isDisabled ? "text-gray-600" : hasSelection ? "text-gray-900" : "text-gray-600"}`}
          >
            {displayText}
          </span>
          <svg className="ml-2 h-4 w-4 shrink-0 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Dropdown */}
        {open && hasOptions ? (
          <div
            ref={listRef}
            role="listbox"
            tabIndex={0}
            onKeyDown={onListKeyDown}
            className="absolute top-full left-0 z-40 mt-1 w-full overflow-hidden rounded-lg border border-gray-300 bg-white shadow-lg focus:outline-none"
          >
            <div className="max-h-[260px] overflow-auto py-1" style={{ maxHeight }}>
              {/* None option for single select */}
              {mode === "single" && (props as SingleSelectProps<T>).noneOption && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    (onChange as (next: string) => void)("");
                    setOpen(false);
                    buttonRef.current?.focus();
                  }}
                  onMouseEnter={() => setActiveIdx(-1)}
                  className={`flex w-full items-center px-3 py-2 text-left text-sm text-gray-400 italic ${
                    activeIdx === -1 ? "bg-blue-50" : ""
                  }`}
                  role="option"
                >
                  {(props as SingleSelectProps<T>).noneOption}
                </button>
              )}

              {options.map((opt, idx) => {
                const active = idx === activeIdx;
                const selected = mode === "single" ? value === opt.value : (value as T[]).includes(opt.value);

                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      (onChange as (next: T) => void)("" as T);
                      setOpen(false);
                      buttonRef.current?.focus();
                    }}
                    className={`flex w-full cursor-pointer items-center ${
                      mode === "multi" ? "gap-2" : ""
                    } px-3 py-2 text-left text-sm ${active ? "bg-blue-50" : ""} ${
                      mode === "single" && selected ? "font-semibold text-blue-600" : ""
                    } ${opt.disabled ? "cursor-not-allowed opacity-50" : ""}`}
                    role="option"
                  >
                    {mode === "multi" && (
                      <input
                        type="checkbox"
                        readOnly
                        checked={selected}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
