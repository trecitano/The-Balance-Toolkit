import React from "react";
import clsx from "clsx";

interface TwoColumnProps {
  label?: string;
  icon?: React.ReactNode;
  error?: string;
  requiredField?: boolean;
  className?: string;
  children: React.ReactNode;
  labelWidth?: string; // optional: control label column width
}

export const TwoColumn: React.FC<TwoColumnProps> = ({
  label,
  icon,
  error,
  requiredField,
  className,
  children,
  labelWidth = "w-1/3", // default: 1/3 of the row
}) => {
  return (
    <div className={clsx("flex items-start gap-2 rounded-lg bg-gray-100 p-(--space-sm)", className)}>
      {label && (
        <label
          className={clsx("flex items-center gap-2 text-(length:--text-sm) font-medium text-gray-600", labelWidth)}
        >
          {icon && <span className="h-5 w-5 flex-shrink-0">{icon}</span>}
          <span>{label}</span>
          {requiredField && <span className="font-bold text-red-500">*</span>}
        </label>
      )}

      <div className="flex flex-1 flex-col">
        {children}
        {error && <p className="mt-0.5 text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
};
