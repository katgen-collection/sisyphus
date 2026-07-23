"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "./navItems";

/**
 * Floating bottom navigation bar for mobile.
 * Semi-transparent white with glassmorphism effect.
 * Hidden on desktop (lg breakpoint).
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-4 left-4 right-4 z-50">
      <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-stone-200/80 shadow-lg shadow-stone-200/50">
        <div className="flex items-center justify-around h-16">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`
                  flex flex-col items-center justify-center gap-1
                  flex-1 min-w-0 h-full px-1 py-2
                  transition-all duration-200
                  ${isActive 
                    ? "text-stone-900" 
                    : "text-stone-400 hover:text-stone-600 active:scale-95"
                  }
                `}
              >
                <div className={`relative ${isActive ? "scale-110" : ""} transition-transform duration-200`}>
                  <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                </div>
                <span className="text-[11px] leading-none font-medium whitespace-nowrap">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      {/* Safe area padding for notched devices */}
      <div className="pb-safe" />
    </nav>
  );
}
