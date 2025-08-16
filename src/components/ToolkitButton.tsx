import React from "react";
import { Link } from "react-router-dom";

type Variant = "grey" | "blue" | "red";
type Size = "sm" | "md" | "lg";

type BaseProps = {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = BaseProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    to?: undefined;
  };

type ButtonAsLink = BaseProps &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
  };

type ButtonProps = ButtonAsButton | ButtonAsLink;

const base =
  "inline-flex items-center justify-center gap-[5px] " +
  "px-4 py-2 rounded-md border-0 cursor-pointer font-semibold " +
  "transition-all shadow-md min-w-[var(--btn-min-width)] " +
  "relative overflow-hidden " +
  "enabled:hover:-translate-y-[1px] " +
  "enabled:active:translate-y-[1px] enabled:active:shadow-inner " +
  "disabled:opacity-60 disabled:cursor-not-allowed " +
  "enabled:focus:outline-none enabled:focus:shadow-[var(--shadow-focus)]";

const byVariant: Record<Variant, string> = {
  grey: "bg-[var(--secondary)] text-[var(--white)] enabled:hover:bg-[var(--secondary-dark)]",
  blue: "bg-[var(--primary)] text-[var(--white)] enabled:hover:bg-[var(--primary-dark)]",
  red: "bg-[var(--red)] text-[var(--white)] enabled:hover:bg-[var(--red-dark)]",
};

const bySize: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-lg",
  lg: "px-6 py-3 text-base",
};

export function ToolkitButton({ variant = "red", size = "md", className = "", children, ...props }: ButtonProps) {
  const classes = [base, byVariant[variant], bySize[size], className].join(" ");

  if ("to" in props && props.to) {
    const { to, ...rest } = props as ButtonAsLink;
    return (
      <Link to={to} className={classes} {...rest}>
        <span>{children}</span>
      </Link>
    );
  }

  const buttonProps = props as ButtonAsButton;
  return (
    <button className={classes} {...buttonProps}>
      <span>{children}</span>
    </button>
  );
}
