import React from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";

type Color = "grey" | "blue" | "red" | "white";
type Size = "none" | "sm" | "md" | "lg";
type Shape = "default" | "circle";

type BaseProps = {
  color?: Color;
  size?: Size;
  shape?: Shape;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
  iconUrl?: string;
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
  "text-sm cursor-pointer font-semibold " +
  "transition-all shadow-md " +
  "enabled:hover:-translate-y-[1px] " +
  "enabled:active:translate-y-[1px] enabled:active:shadow-inner " +
  "disabled:opacity-60 disabled:cursor-not-allowed " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

const byColor: Record<Color, string> = {
  grey: "bg-(--secondary) text-[var(--white)] enabled:hover:bg-[var(--secondary-dark)]",
  blue: "bg-(--primary) text-[var(--white)] enabled:hover:bg-[var(--primary-dark)]",
  red: "bg-(--red) text-[var(--white)] enabled:hover:bg-[var(--red-dark)]",
  white: "bg-white  enabled:hover:shadow-lg enabled:hover:bg-gray-50 border border-gray-200",
};

const byShape: Record<Shape, string> = {
  default: "rounded-lg",
  circle: "rounded-full aspect-square",
};

const bySize: Record<Size, string> = {
  none: "",
  sm: "px-4 py-2",
  md: "px-4 py-3",
  lg: "",
};

export function ToolkitButton({
  color = "red",
  size = "md",
  shape = "default",
  className = "",
  children,
  iconUrl,
  ...props
}: ButtonProps) {
  const classes = clsx(byShape[shape], bySize[size], byColor[color], base, className);

  const content = iconUrl ? (
    <span className="flex items-center gap-2">
      <img src={iconUrl} alt="" className="size-5 object-contain brightness-0 invert" />
      <span>{children}</span>
    </span>
  ) : (
    <span>{children}</span>
  );

  if ("to" in props && props.to) {
    const { to, ...rest } = props as ButtonAsLink;
    return (
      <Link to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }

  // Buttons default to `type="button"` so they never submit an enclosing form by accident.
  const buttonProps = props as ButtonAsButton;
  return (
    <button type="button" className={classes} {...buttonProps}>
      {content}
    </button>
  );
}
