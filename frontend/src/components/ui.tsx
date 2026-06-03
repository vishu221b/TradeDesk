import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./icons";

export function Button({
  variant = "primary",
  loading,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
  loading?: boolean;
}) {
  const cls =
    variant === "primary" ? "btn-primary" : variant === "outline" ? "btn-outline" : "btn-ghost";
  return (
    <button className={`${cls} ${className}`} disabled={loading || rest.disabled} {...rest}>
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    neutral: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    accent: "bg-accent-soft text-accent",
  };
  return <span className={`chip ${tones[tone] ?? tones.neutral}`}>{children}</span>;
}

export function Spin() {
  return (
    <div className="flex h-full w-full items-center justify-center p-10 text-gray-400">
      <Spinner className="h-6 w-6" />
    </div>
  );
}
