import React from "react";
import clsx from "clsx";

interface InputPrimitiveProps extends React.InputHTMLAttributes<HTMLInputElement> {
  editable?: boolean;
  error?: string;
}

export const InputPrimitive: React.FC<InputPrimitiveProps> = ({ editable, error, className, type, ...props }) => {
  if (editable) {
    if (type === "checkbox") {
      return (
        <input
          type="checkbox"
          className={clsx(
            "h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-(length:--text-sm)",
            error && "border-red-500 text-red-600 focus:ring-red-500",
            className,
          )}
          {...props}
        />
      );
    }

    return (
      <input
        className={clsx(
          "h-10 rounded-md px-3 py-2 text-(length:--text-sm)",
          "border border-gray-300 bg-white",
          "transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200",
          error && "border-red-500 focus:border-red-500 focus:ring-red-200",
          className,
        )}
        {...props}
        value={props.value ?? ""}
      />
    );
  }

  return (
    <div
      className={clsx(
        "h-10 rounded-md px-3 py-2 text-(length:--text-sm)",
        "border border-gray-200 bg-gray-100 text-gray-600",
        "flex items-center",
        "cursor-not-allowed select-none",
        className,
      )}
    >
      {props.value}
    </div>
  );
};
