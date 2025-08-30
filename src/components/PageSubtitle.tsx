import { ReactNode } from "react";

interface HeadingProps {
  children: ReactNode;
  className?: string;
}

export default function PageSubtitle({ children, className = "" }: HeadingProps) {
  return <h2 className={`text-[1.6vh] font-semibold ${className}`}>{children}</h2>;
}
