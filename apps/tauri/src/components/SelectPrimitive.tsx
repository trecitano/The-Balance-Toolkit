import { useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Key, KeyboardEvent, MouseEvent, ReactElement } from "react";
import { FieldLabelContext } from "./FieldLabelContext";

export type BaseOption<T = string> = { value: T; label: string; disabled?: boolean };
type Shared<T> = {
  options: BaseOption<T>[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxHeight?: number;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /**
   * A last entry that leads to the page where the options are managed, such as Devices for boards.
   * It stays pinned to the bottom of the list, so it is visible however many options there are.
   */
  link?: { label: string; to: string };
};
type Props<T> = Shared<T> &
  (
    | { mode?: "single"; value: T; onChange: (next: T) => void; noneOption?: false }
    | { mode?: "single"; value: T | undefined; onChange: (next: T | undefined) => void; noneOption: string }
    | { mode: "multi"; value: T[]; onChange: (next: T[]) => void; noOptionsMessage?: string }
  );

export function SelectPrimitive<T extends Key = string>(
  props: Shared<T> & { mode?: "single"; value: T; onChange: (next: T) => void; noneOption?: false },
): ReactElement;
export function SelectPrimitive<T extends Key = string>(
  props: Shared<T> & {
    mode?: "single";
    value: T | undefined;
    onChange: (next: T | undefined) => void;
    noneOption: string;
  },
): ReactElement;
export function SelectPrimitive<T extends Key = string>(
  props: Shared<T> & { mode: "multi"; value: T[]; onChange: (next: T[]) => void; noOptionsMessage?: string },
): ReactElement;
export function SelectPrimitive<T extends Key = string>(props: Props<T>) {
  const { options, className, maxHeight = 260, link } = props;
  const navigate = useNavigate();
  // The link entry comes after the options, so it takes the next index.
  const linkIndex = options.length;
  const labelId = useContext(FieldLabelContext);
  const listId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState({ open: false, above: false, active: 0 });
  const none = props.mode !== "multi" && typeof props.noneOption === "string" ? props.noneOption : null;
  const enabledIndices = [
    ...(none !== null ? [-1] : []),
    ...options.flatMap((option, index) => (option.disabled ? [] : [index])),
    ...(link ? [linkIndex] : []),
  ];
  const disabled = props.disabled || enabledIndices.length === 0;
  const isSelected = (value: T) => (props.mode === "multi" ? props.value.includes(value) : props.value === value);
  const selectedLabels = options.filter((option) => isSelected(option.value)).map((option) => option.label);
  const display =
    props.mode === "multi"
      ? !options.length
        ? (props.noOptionsMessage ?? "No options available")
        : selectedLabels.length > 1
          ? `${selectedLabels.length} selected`
          : (selectedLabels[0] ?? props.placeholder ?? "None selected")
      : (selectedLabels[0] ?? none ?? props.placeholder ?? "Select an option");
  const hide = () => setMenu((previous) => ({ ...previous, open: false }));
  const close = () => {
    hide();
    trigger.current?.focus();
  };
  const choose = (index: number) => {
    if (disabled) return;
    if (link && index === linkIndex) {
      hide();
      navigate(link.to);
      return;
    }
    if (index === -1 && props.mode !== "multi" && typeof props.noneOption === "string") {
      props.onChange(undefined);
      close();
      return;
    }
    const option = options[index];
    if (!option || option.disabled) return;
    if (props.mode === "multi")
      props.onChange(
        isSelected(option.value)
          ? props.value.filter((value) => value !== option.value)
          : [...props.value, option.value],
      );
    else {
      props.onChange(option.value);
      close();
    }
  };
  // What every entry in the list shares: its id for aria-activedescendant, and mouse handling
  // that keeps the focus on the list. Each entry still states its own type and role.
  const entryProps = (index: number) => ({
    id: `${listId}-${index}`,
    tabIndex: -1,
    onMouseDown: (event: MouseEvent) => event.preventDefault(),
    onClick: () => choose(index),
    onMouseEnter: () => {
      if (enabledIndices.includes(index)) setMenu((previous) => ({ ...previous, active: index }));
    },
  });
  const show = () => {
    if (disabled) return;
    const rect = trigger.current?.getBoundingClientRect();
    const selected = options.findIndex((option) => !option.disabled && isSelected(option.value));
    setMenu({
      open: true,
      active: selected >= 0 ? selected : (enabledIndices[0] ?? 0),
      above: !!rect && window.innerHeight - rect.bottom < maxHeight + 8 && rect.top > window.innerHeight - rect.bottom,
    });
  };
  const focusList = useCallback((element: HTMLDivElement | null) => {
    list.current = element;
    element?.focus();
  }, []);
  useEffect(() => {
    if (menu.open)
      list.current?.querySelector(`#${CSS.escape(`${listId}-${menu.active}`)}`)?.scrollIntoView({ block: "nearest" });
  }, [menu.active, menu.open, listId]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(menu.active);
      return;
    }
    const current = enabledIndices.indexOf(menu.active);
    let next: number | undefined;
    if (event.key === "ArrowDown") next = enabledIndices[Math.min(current + 1, enabledIndices.length - 1)];
    if (event.key === "ArrowUp") next = enabledIndices[Math.max(current - 1, 0)];
    if (event.key === "Home") next = enabledIndices[0];
    if (event.key === "End") next = enabledIndices[enabledIndices.length - 1];
    if (next !== undefined) {
      event.preventDefault();
      setMenu((previous) => ({ ...previous, active: next }));
    }
  };
  return (
    <div
      className={className}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setMenu((previous) => ({ ...previous, open: false }));
      }}
    >
      <div className="relative">
        <button
          ref={trigger}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={menu.open && !disabled}
          aria-controls={menu.open ? listId : undefined}
          aria-label={props["aria-label"]}
          aria-labelledby={props["aria-labelledby"] ?? (props["aria-label"] ? undefined : labelId)}
          onClick={() => (menu.open ? close() : show())}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              show();
            }
          }}
          className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100/80"
        >
          <span className="truncate">{display}</span>
          <span aria-hidden="true">▾</span>
        </button>
        {menu.open &&
          !disabled && (
            // With a link, scrolling an option into view keeps the pinned link's height (scroll-pb-10)
            // clear at the bottom, so the link never covers the active option.
            <div
              ref={focusList}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-label={props["aria-label"] ?? (labelId ? undefined : "Options")}
              aria-labelledby={props["aria-labelledby"] ?? (props["aria-label"] ? undefined : labelId)}
              aria-multiselectable={props.mode === "multi" || undefined}
              aria-activedescendant={`${listId}-${menu.active}`}
              onKeyDown={onKeyDown}
              style={{ maxHeight }}
              className={`absolute ${menu.above ? "bottom-full mb-1" : "top-full mt-1"} left-0 z-40 w-full overflow-auto rounded-lg border border-gray-300 bg-white shadow-lg outline-none ${link ? "scroll-pb-10 pt-1" : "py-1"}`}
            >
              {none !== null && (
                <button
                  {...entryProps(-1)}
                  type="button"
                  role="option"
                  aria-selected={props.value === undefined}
                  className={`w-full px-3 py-2 text-left text-sm ${menu.active === -1 ? "bg-(--bg-light)" : ""}`}
                >
                  {none}
                </button>
              )}
              {options.map((option, index) => (
                <button
                  key={String(option.value)}
                  {...entryProps(index)}
                  type="button"
                  role="option"
                  disabled={option.disabled}
                  aria-selected={isSelected(option.value)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm disabled:opacity-50 ${menu.active === index ? "bg-(--bg-light)" : ""} ${isSelected(option.value) ? "font-semibold text-(--primary)" : ""}`}
                >
                  {props.mode === "multi" && <CheckMark checked={isSelected(option.value)} />}
                  <span className="truncate">{option.label}</span>
                </button>
              ))}
              {link && (
                <button
                  {...entryProps(linkIndex)}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className={`sticky bottom-0 mt-1 flex w-full items-center justify-between border-t border-gray-200 px-3 pt-2.5 pb-2 text-left text-sm font-medium text-(--primary) ${menu.active === linkIndex ? "bg-(--bg-light)" : "bg-white"}`}
                >
                  {link.label}
                  <span aria-hidden="true">→</span>
                </button>
              )}
            </div>
          )}
      </div>
    </div>
  );
}

/** The tick box beside each option of a multi-select, in the app's blue. */
function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-4 shrink-0 items-center justify-center rounded border ${checked ? "border-(--primary) bg-(--primary) text-white" : "border-gray-300 bg-white"}`}
    >
      {checked && (
        <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}
