import React, { useContext } from "react";
import { FieldLabelContext } from "./FieldLabelContext";
import clsx from "clsx";

interface InputPrimitiveProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Checkbox({ className, type: _type, ...props }: InputPrimitiveProps) {
  const labelId = useContext(FieldLabelContext);
  return (
    <input
      className={clsx("disabled:cursor-not-allowed disabled:bg-gray-100/80", className)}
      type="checkbox"
      aria-labelledby={props["aria-labelledby"] ?? (props["aria-label"] ? undefined : labelId)}
      {...props}
      value={props.value ?? ""}
    />
  );
}
