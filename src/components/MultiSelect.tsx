import React, { useMemo, useRef, useState } from "react";

export type CheckboxOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "None selected",
  className = "",
  disabled = false,
  maxHeight = 260,
}: {
  label?: string;
  options: CheckboxOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxHeight?: number;
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const selectedLabels = useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label]));
    return value.map((v) => map.get(v) ?? v);
  }, [options, value]);

  const toggleValue = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };

  const handleBlur: React.FocusEventHandler<HTMLDivElement> = (e) => {
    const next = e.relatedTarget as Node | null;
    const root = rootRef.current;
    if (root && next && root.contains(next)) return;
    setOpen(false);
  };

  const onTriggerKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
    if (disabled) return;
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
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      const opt = options[activeIdx];
      if (opt && !opt.disabled) toggleValue(opt.value);
    }
  };

  const display =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length === 1
        ? selectedLabels[0]
        : `${selectedLabels.length} selected`;

  return (
    <div ref={rootRef} className={className} onBlur={handleBlur} tabIndex={-1}>
      {label ? <label className="mb-1 block text-xs font-semibold text-gray-700">{label}</label> : null}

      {/* Relative wrapper so popup is absolutely positioned and doesn't shift layout */}
      <div className="relative">
        {/* Trigger */}
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault();
            if (disabled) return;
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
          className={`relative flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 text-left text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
            open ? "ring-2 ring-blue-100" : ""
          }`}
        >
          <span className={`truncate ${selectedLabels.length ? "text-gray-900" : "text-gray-500"}`}>{display}</span>
          <svg
            className="ml-2 h-4 w-4 shrink-0 text-gray-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Absolutely positioned popover that overlays, not pushes layout */}
        {open ? (
          <div
            ref={listRef}
            role="listbox"
            tabIndex={0}
            onKeyDown={onListKeyDown}
            className="absolute top-full left-0 z-40 mt-1 w-full overflow-hidden rounded-md border border-gray-300 bg-white shadow-lg focus:outline-none"
          >
            <div className="max-h-[260px] overflow-auto py-1" style={{ maxHeight }}>
              {options.map((opt, idx) => {
                const checked = value.includes(opt.value);
                const active = idx === activeIdx;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (!opt.disabled) toggleValue(opt.value);
                    }}
                    className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm ${
                      active ? "bg-blue-50" : ""
                    } ${opt.disabled ? "cursor-not-allowed opacity-50" : ""}`}
                    role="option"
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={checked}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
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
