import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
} & ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const variants = {
    primary: "bg-[var(--foreground)] text-[var(--surface)] hover:opacity-85",

    secondary:
      "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-soft)]",

    ghost: "text-[var(--muted)] hover:text-[var(--foreground)]",
  };

  return (
    <button
      {...props}
      className={`
        rounded-xl
        px-4
        py-2.5
        text-sm
        font-medium
        transition
        disabled:pointer-events-none
        disabled:opacity-50
        ${variants[variant]}
        ${className}
      `}
    >
      {children}
    </button>
  );
}
