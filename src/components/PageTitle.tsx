import { ReactNode } from "react";

interface HeadingProps {
  children: ReactNode;
  className?: string;
}

export default function Heading({ children, className = "" }: HeadingProps) {
  return <h1 className={`text-4xl font-semibold ${className}`}>{children}</h1>;
}
