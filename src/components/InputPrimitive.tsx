import React from "react";
import clsx from "clsx";

interface InputPrimitiveProps extends React.InputHTMLAttributes<HTMLInputElement> {
  editable?: boolean;
  error?: string;
}

export const InputPrimitive: React.FC<InputPrimitiveProps> = ({ editable = true, error, className, ...props }) => {
  if (editable) {
    return (
      <input
        className={clsx(
          "min-h-[5vh] rounded-md px-3 py-2 text-(length:--text-sm)",
          "border border-gray-300 bg-white",
          "transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200",
          error && "border-red-500 focus:border-red-500 focus:ring-red-200",
          className,
        )}
        {...props}
      />
    );
  }

  return (
    <div
      className={clsx(
        "box-border flex min-h-[5vh] w-full items-center overflow-hidden rounded-(--radius-sm)",
        "border border-transparent bg-(--light) p-(--space-sm) text-(length:--text-sm)",
        "break-words text-ellipsis whitespace-normal text-(--text) shadow-[var(--shadow-inset)]",
        className,
      )}
    >
      {props.value}
    </div>
  );
};
