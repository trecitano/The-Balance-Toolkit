import React from "react";
import clsx from "clsx";

type ContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  background?: string;
};

const ToolkitContainer = React.forwardRef<HTMLDivElement, ContainerProps>(function ToolkitContainer(
  { className, background = "bg-white/80", children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={clsx(className, "rounded-lg border-(--border-primary) p-3 shadow-(--shadow-light)", background)}
      {...rest}
    >
      {children}
    </div>
  );
});

export default ToolkitContainer;
