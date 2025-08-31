import React from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";

type Color = "grey" | "blue" | "red";
type Size = "none" | "sm" | "md" | "lg";
type Shape = "default" | "circle";

type BaseProps = {
  color?: Color;
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

const byColor: Record<Color, string> = {
  grey: "bg-[var(--secondary)] text-[var(--white)] enabled:hover:bg-[var(--secondary-dark)]",
  blue: "bg-[var(--primary)] text-[var(--white)] enabled:hover:bg-[var(--primary-dark)]",
  red: "bg-[var(--red)] text-[var(--white)] enabled:hover:bg-[var(--red-dark)]",
};

const byShape: Record<Shape, string> = {
  default: "rounded-lg",
  circle: "rounded-full aspect-square",
};

const bySize: Record<Size, string> = {
  none: "",
  sm: "",
  md: "px-4 py-3",
  lg: "",
};

export function ToolkitButton({
  color = "red",
  size = "md",
  shape = "default",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const classes = clsx(byShape[shape], bySize[size], byColor[color], base, className);

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
