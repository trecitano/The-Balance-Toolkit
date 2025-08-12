import React from "react";
import clsx from "clsx";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  error?: string;
  requiredField?: boolean;
  containerClassName?: string;
}

export const Input: React.FC<InputProps> = ({
                                              label,
                                              icon,
                                              error,
                                              requiredField,
                                              containerClassName,
                                              className,
                                              ...props
                                            }) => {
  return (
    <div className={clsx("flex flex-col gap-1 w-full", containerClassName)}>
      {label && (
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          {icon && <span className="w-4 h-4 flex-shrink-0">{icon}</span>}
          {label}
          {requiredField && <span className="text-red-500 font-bold">*</span>}
        </label>
      )}

      <input
        className={clsx(
          "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm",
          "focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition",
          error && "border-red-500 focus:border-red-500 focus:ring-red-200",
          className
        )}
        {...props}
      />

      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
};