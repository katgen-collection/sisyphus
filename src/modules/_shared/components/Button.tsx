"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-canvas hover:opacity-90 active:opacity-80 disabled:bg-surface-muted disabled:text-muted",
  secondary:
    "bg-surface-muted text-primary hover:bg-border-strong active:bg-surface-muted disabled:bg-surface-subtle disabled:text-muted",
  ghost:
    "bg-transparent text-secondary hover:bg-surface-subtle active:bg-surface-muted disabled:text-muted",
};

/**
 * Minimal button component.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", loading = false, className = "", children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center gap-2
          px-5 py-2.5 rounded-lg font-medium
          transition-colors duration-150
          disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${className}
        `}
        {...props}
      >
        {loading && <Loader2 className="animate-spin h-4 w-4" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
