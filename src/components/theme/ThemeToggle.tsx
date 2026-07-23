"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  getServerThemeSnapshot,
  getThemeSnapshot,
  subscribeTheme,
  toggleTheme,
} from "./theme";

interface ThemeToggleProps {
  mobile?: boolean;
  collapsed?: boolean;
}

export function ThemeToggle({ mobile = false, collapsed = false }: ThemeToggleProps) {
  const { theme } = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";
  const modeLabel = isDark ? "Light mode" : "Dark mode";
  const Icon = isDark ? Sun : Moon;
  const iconOnly = mobile || collapsed;

  return (
    <button
      type="button"
      aria-pressed={isDark}
      aria-label={label}
      title={iconOnly ? label : undefined}
      onClick={toggleTheme}
      className={mobile
        ? "fixed right-3 top-[calc(env(safe-area-inset-top)+3.5rem)] z-30 inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-surface-glass text-secondary shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-border-strong hover:bg-surface-raised hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus lg:hidden"
        : `flex items-center justify-center rounded-xl border border-transparent text-secondary transition-all duration-200 hover:border-border hover:bg-surface-subtle hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${collapsed ? "min-h-11 min-w-11 mx-auto" : "min-h-11 w-full gap-2 px-3"}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!iconOnly && <span className="text-xs font-medium whitespace-nowrap">{modeLabel}</span>}
    </button>
  );
}
