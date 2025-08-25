import React, { useMemo, useRef, useState } from "react";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function SelectPrimitive({
  label,
  options,
  value,
  onChange,
  placeholder = "Select an option",
  className = "",
  disabled = false,
  maxHeight = 260,
  noneOption,
}: {
  label?: string;
  options: SelectOption[];
  value: string | null;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxHeight?: number;
  noneOption?: string | false;
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const selectedLabel = useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label]));
    return value ? (map.get(value) ?? value) : null;
  }, [options, value]);

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
      if (opt && !opt.disabled) {
        onChange(opt.value);
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
  };

  return (
    <div ref={rootRef} className={className} onBlur={handleBlur} tabIndex={-1}>
      {label ? <label className="mb-1 block text-xs font-semibold text-gray-700">{label}</label> : null}

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
          className={`relative flex h-10 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 text-left text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
            open ? "ring-2 ring-blue-100" : ""
          }`}
        >
          <span className={`truncate ${selectedLabel ? "text-gray-900" : "text-gray-500"}`}>
            {selectedLabel ?? placeholder}
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
        {open ? (
          <div
            ref={listRef}
            role="listbox"
            tabIndex={0}
            onKeyDown={onListKeyDown}
            className="absolute top-full left-0 z-40 mt-1 w-full overflow-hidden rounded-lg border border-gray-300 bg-white shadow-lg focus:outline-none"
          >
            <div className="max-h-[260px] overflow-auto py-1" style={{ maxHeight }}>
              {noneOption && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange("");
                    setOpen(false);
                    buttonRef.current?.focus();
                  }}
                  onMouseEnter={() => setActiveIdx(-1)} // 👈 track hover for keyboard nav
                  className={`italic" flex w-full items-center px-3 py-2 text-left text-sm text-gray-400 ${activeIdx === -1 ? "bg-blue-50" : ""} `}
                  role="option"
                >
                  {noneOption}
                </button>
              )}

              {options.map((opt, idx) => {
                const active = idx === activeIdx;
                const selected = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (!opt.disabled) {
                        onChange(opt.value);
                        setOpen(false);
                        buttonRef.current?.focus();
                      }
                    }}
                    className={`flex w-full cursor-pointer items-center px-3 py-2 text-left text-sm ${
                      active ? "bg-blue-50" : ""
                    } ${selected ? "font-semibold text-blue-600" : ""} ${
                      opt.disabled ? "cursor-not-allowed opacity-50" : ""
                    }`}
                    role="option"
                  >
                    {opt.label}
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
