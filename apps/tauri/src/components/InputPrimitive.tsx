import React, { useContext } from "react";
import { FieldLabelContext } from "./FieldLabelContext";
import clsx from "clsx";

interface InputPrimitiveProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function InputPrimitive({ className, type, ...props }: InputPrimitiveProps) {
  const labelId = useContext(FieldLabelContext);
  return (
    <input
      className={clsx(
        "h-8 min-w-0 w-full rounded-lg px-3 py-2 text-sm",
        "border border-gray-300 bg-white",
        "transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200",
        "disabled:cursor-not-allowed disabled:bg-gray-100/80 disabled:text-gray-600",
        className,
      )}
      type={type}
      aria-labelledby={props["aria-labelledby"] ?? (props["aria-label"] ? undefined : labelId)}
      {...props}
      value={props.value ?? ""}
    />
  );
}
