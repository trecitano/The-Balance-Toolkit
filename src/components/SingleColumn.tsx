import React from "react";
import clsx from "clsx";

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  error?: string;
  requiredField?: boolean;
  containerClassName?: string;
  children: React.ReactNode;
}

export const SingleColumn: React.FC<InputFieldProps> = ({
  label,
  icon,
  error,
  requiredField,
  containerClassName,
  children,
}) => {
  return (
    <div className={clsx("flex flex-col gap-(--space-xs) rounded-md bg-gray-100 p-(--space-sm)", containerClassName)}>
      {label && (
        <label className="flex gap-2 text-(length:--text-sm) font-medium text-gray-600">
          {icon && <span className="h-5 w-5 flex-shrink-0">{icon}</span>}
          {label}
          {requiredField && <span className="font-bold text-red-500">*</span>}
        </label>
      )}

      {children}

      {error && <p className="mt-0.5 text-xs text-red-500">{error}</p>}
    </div>
  );
};
