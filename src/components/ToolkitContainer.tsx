import React from "react";
import clsx from "clsx";

type ContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  background?: string;
};

export default function ToolkitContainer({ className, background = "bg-white/80", children, ...rest }: ContainerProps) {
  return (
    <div
      className={clsx(
        "rounded-lg border-[0.1rem] border-(--border-primary) p-3 shadow-(--shadow-light)",
        background,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
