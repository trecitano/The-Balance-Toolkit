import React from "react";
import clsx from "clsx";

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
  tooltipText?: string;
}

// Simple info icon component
const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

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
  tooltipText,
}) => {
  return (
    <div
      className={clsx(
        "box-border flex flex-col gap-(--space-xs) rounded-lg p-(--space-sm)",
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
              {tooltipText && (
                <div className="group relative">
                  <InfoIcon className="h-4 w-4 cursor-help text-gray-400 hover:text-gray-600" />
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 transform rounded-md bg-gray-900 px-3 py-2 text-sm whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                    {tooltipText}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 transform border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              )}
            </div>
          </label>

          {actionText && onActionClick && (
            <button
              type="button"
              onClick={onActionClick}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              {actionText}
            </button>
          )}
        </div>
      )}

      <div className={clsx("flex", direction === "col" ? "flex-col gap-(--space-xs)" : "flex-row items-center gap-2")}>
        {children}
      </div>

      {error && <p className="mt-0.5 text-xs text-red-500">{error}</p>}
    </div>
  );
};
