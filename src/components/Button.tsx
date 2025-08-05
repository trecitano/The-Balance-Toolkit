import React from "react";

    type Variant = "primary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

const base =
  "inline-flex items-center justify-center rounded-full transition-colors " +
  "focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-60 disabled:cursor-not-allowed";

const byVariant: Record<Variant, string> = {
  primary: "bg-red-600 text-white hover:bg-red-700",
  outline:
    "border-2 border-red-600 text-red-600 bg-white hover:bg-red-50",
  ghost: "text-red-600 hover:bg-red-50",
};

const bySize: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-lg",
  lg: "px-6 py-3 text-base",
};

export function Button({
                         variant = "primary",
                         size = "md",
                         fullWidth,
                         leftIcon,
                         rightIcon,
                         className = "",
                         children,
                         ...props
                       }: ButtonProps) {
  return (
    <button
      className={[
        base,
        byVariant[variant],
        bySize[size],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      {...props}
    >
      {leftIcon ? <span className="mr-2 h-5 w-5">{leftIcon}</span> : null}
      <span>{children}</span>
      {rightIcon ? <span className="ml-2 h-5 w-5">{rightIcon}</span> : null}
    </button>
  );
}