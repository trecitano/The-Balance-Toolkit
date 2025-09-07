import React from "react";
import clsx from "clsx";

interface InputPrimitiveProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Checkbox({ className, type, ...props }: InputPrimitiveProps) {
  return (
    <input
      className={clsx(
        "disabled:cursor-not-allowed disabled:bg-gray-100/80",
        className,
      )}
      type="checkbox"
      {...props}
      value={props.value ?? ""}
    />
  );
}
