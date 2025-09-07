import { ReactNode } from "react";

interface HeadingProps {
  children: ReactNode;
  className?: string;
}

export default function PageTitle({ children, className = "" }: HeadingProps) {
  return <h1 className={`ml-2 text-4xl font-semibold ${className}`}>{children}</h1>;
}
