import React from "react";
import clsx from "clsx";
import { Tooltip } from "@/components/Tooltip.tsx";

type BackgroundType = "default" | "transparent" | "error";

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  error?: string;
  requiredField?: boolean;
  className?: string;
  children: React.ReactNode;
  direction?: "col" | "row";
  backgroundType?: BackgroundType;
  actionText?: string;
  onActionClick?: () => void;
  tooltipId?: string;
}

export const SingleColumn: React.FC<InputFieldProps> = ({
  label,
  icon,
  error,
  requiredField,
  className,
  children,
  direction = "col",
  backgroundType = "transparent",
  actionText,
  onActionClick,
  tooltipId,
}) => {
  return (
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
          <label className="ml-2 flex gap-2 text-xs font-medium text-gray-600">
            <div className="flex items-center gap-2">
              {icon && <span className="h-5 w-5 flex-shrink-0">{icon}</span>}
              {label}
              {requiredField && <span className="font-bold text-red-500">*</span>}
              {tooltipId && <Tooltip tooltipId={tooltipId} />}
            </div>
          </label>

          {actionText && onActionClick && (
            <button
              type="button"
              onClick={onActionClick}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              {actionText}
            </button>
          )}
        </div>
      )}

      <div className={clsx("flex", direction === "col" ? "flex-col gap-(--space-xs)" : "flex-row flex-1 items-center gap-2")}>
        {children}
      </div>

      {error && <p className="mt-0.5 text-xs text-red-500">{error}</p>}
    </div>
  );
};
