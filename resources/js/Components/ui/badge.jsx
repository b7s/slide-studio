import * as React from "react";
import { cn } from "../lib/utils";

function Badge({ className, variant = "default", ...props }) {
  const variants = {
    default: "border border-[var(--border)] bg-[var(--secondary)] text-[var(--foreground)]",
    gold: "border border-[var(--gold)]/50 bg-[var(--accent)] text-[var(--accent-foreground)]",
    success: "border border-[var(--success)]/20 bg-[var(--success)]/10 text-[var(--success)]",
    danger: "border border-[var(--red)]/20 bg-[var(--red)]/10 text-[var(--red)]",
    outline: "border border-[var(--border)] text-[var(--foreground)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
