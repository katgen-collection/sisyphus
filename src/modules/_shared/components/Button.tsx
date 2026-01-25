"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-stone-800 text-stone-50 
    hover:bg-stone-700 active:bg-stone-900
    disabled:bg-stone-300
  `,
  secondary: `
    bg-stone-200 text-stone-800 
    hover:bg-stone-300 active:bg-stone-400
    disabled:bg-stone-100 disabled:text-stone-400
  `,
  ghost: `
    bg-transparent text-stone-600 
    hover:bg-stone-100 active:bg-stone-200
    disabled:text-stone-300
  `,
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
