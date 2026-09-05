import { ReactNode } from "react";

interface HeadingProps {
  children: ReactNode;
  className?: string;
}

export default function PageSubtitle({ children, className = "" }: HeadingProps) {
  return <h2 className={`text-base font-semibold ${className}`}>{children}</h2>;
}
