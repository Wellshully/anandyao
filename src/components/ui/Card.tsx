import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-neutral-200 bg-white p-5 ${className}`}
    >
      {children}
    </div>
  );
}
