import React from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";

type Variant = "grey" | "blue" | "red" | "white";
type Size = "none" | "sm" | "md" | "lg";
type Shape = "default" | "circle";

type BaseProps = {
  variant?: Variant;
  size?: Size;
  shape?: Shape;
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
  "leading-none " +
  "text-lg cursor-pointer font-semibold " +
  "transition-all shadow-md " +
  "enabled:hover:-translate-y-[1px] " +
  "enabled:active:translate-y-[1px] enabled:active:shadow-inner " +
  "disabled:opacity-60 disabled:cursor-not-allowed " +
  "enabled:focus:outline-none enabled:focus:shadow-[var(--shadow-focus)]";

const byVariant: Record<Variant, string> = {
  grey: "bg-[var(--secondary)] text-[var(--white)] enabled:hover:bg-[var(--secondary-dark)]",
  blue: "bg-[var(--primary)] text-[var(--white)] enabled:hover:bg-[var(--primary-dark)]",
  red: "bg-[var(--red)] text-[var(--white)] enabled:hover:bg-[var(--red-dark)]",
  white:
    "bg-white text-gray-800 shadow-(--shadow-light) enabled:hover:shadow-lg enabled:hover:bg-gray-50 border border-gray-200",
};

const byShape: Record<Shape, string> = {
  default: "rounded-lg",
  circle: "rounded-full aspect-square",
};

const bySize: Record<Size, string> = {
  none: "",
  sm: "",
  md: "p-2",
  lg: "",
};

export function ToolkitButton({
  variant = "red",
  size = "md",
  shape = "default",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const classes = clsx(byShape[shape], bySize[size], byVariant[variant], base, className);

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
