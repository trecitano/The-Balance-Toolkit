import { ReactNode, InputHTMLAttributes, useId } from "react";
import { FieldLabelContext } from "./FieldLabelContext";
import clsx from "clsx";
import { Tooltip } from "@/components/Tooltip.tsx";

type BackgroundType = "default" | "transparent" | "error";

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: ReactNode;
  error?: string;
  requiredField?: boolean;
  className?: string;
  children: ReactNode;
  direction?: "col" | "row";
  backgroundType?: BackgroundType;
  disabled?: boolean;
  actionText?: string;
  onActionClick?: () => void;
  tooltipId?: string;
  labelMargin?: boolean;
}

export function SingleColumn({
  label,
  icon,
  error,
  requiredField,
  className,
  children,
  direction = "col",
  backgroundType = "transparent",
  disabled,
  actionText,
  onActionClick,
  tooltipId,
  labelMargin = true,
}: InputFieldProps) {
  const labelId = useId();
  return (
    <FieldLabelContext value={label ? labelId : undefined}>
      <div
        className={clsx(
          "box-border flex flex-col gap-(--space-xs) rounded-lg p-2",
          {
            "bg-gray-100": backgroundType === "default",
            "bg-transparent": backgroundType === "transparent",
            "border border-red-300 bg-red-50": backgroundType === "error",
          },
          className,
        )}
      >
        {label && (
          <div className="flex items-center gap-3">
            <div className={clsx(labelMargin && "ml-2", "flex gap-2 text-xs font-medium text-gray-600")}>
              <div className="flex items-center gap-2">
                {icon && <span className="h-5 w-5 flex-shrink-0">{icon}</span>}
                <span id={labelId}>{label}</span>
                {requiredField && <span className="font-bold text-red-500">*</span>}
                {tooltipId && <Tooltip tooltipId={tooltipId} />}
              </div>
            </div>

            {actionText && onActionClick && (
              <button
                type="button"
                disabled={disabled}
                onClick={onActionClick}
                className={clsx(
                  "text-xs text-blue-600 enabled:hover:text-blue-800 enabled:hover:underline",
                  "disabled:cursor-not-allowed disabled:bg-gray-100/80 disabled:text-gray-600",
                )}
              >
                {actionText}
              </button>
            )}
          </div>
        )}

        <div
          className={clsx(
            "flex",
            direction === "col" ? "flex-col gap-(--space-xs)" : "flex-1 flex-row items-center gap-2",
          )}
        >
          {children}
        </div>

        {error && <p className="mt-0.5 text-xs text-red-500">{error}</p>}
      </div>
    </FieldLabelContext>
  );
}
