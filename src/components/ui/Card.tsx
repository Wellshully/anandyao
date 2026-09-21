import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`
        rounded-[var(--radius-md)]
        border
        border-[var(--border)]
        bg-[var(--surface)]
        ${className}
      `}
    >
      {children}
    </div>
  );
}
