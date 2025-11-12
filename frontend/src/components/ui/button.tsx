import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "secondary" | "destructive" | "primary";
};

export function Button({ variant = "primary", className = "", ...props }: Props) {
  const base = "inline-flex items-center gap-2 rounded px-3 py-2 text-sm";
  const styles =
    variant === "secondary"
      ? "border border-primary bg-white text-primary"
      : variant === "destructive"
      ? "bg-red-600 text-white"
      : "bg-primary text-white";
  return <button {...props} className={`${base} ${styles} ${className}`} />;
}