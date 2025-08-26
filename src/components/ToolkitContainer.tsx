import React from "react";
import clsx from "clsx";

type ContainerProps = React.HTMLAttributes<HTMLDivElement>;

export default function ToolkitContainer({ className, children, ...rest }: ContainerProps) {
  return (
    <div
      className={clsx(
        "rounded-lg border-[0.1rem] border-(--border-primary) bg-white/80 p-3 shadow-(--shadow-light)",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
