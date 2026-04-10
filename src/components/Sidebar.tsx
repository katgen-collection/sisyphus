"use client";

import { Home, Video, FileText, FileCode, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/video", icon: Video, label: "Video" },
  { href: "/pdf", icon: FileText, label: "PDF" },
  { href: "/markdown", icon: FileCode, label: "Markdown" },
];

/**
 * Collapsible sidebar navigation for desktop view.
 * Expanded (w-64): logo + name + nav links with labels
 * Collapsed (w-16): icon-only logo + icon-only nav links
 * State is persisted in localStorage and reflected via data-sidebar on <html>.
 */
export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Initialise from localStorage after mount (client-only)
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    const isCollapsed = stored === "true";
    setCollapsed(isCollapsed);
    document.documentElement.setAttribute(
      "data-sidebar",
      isCollapsed ? "collapsed" : "expanded"
    );
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      document.documentElement.setAttribute(
        "data-sidebar",
        next ? "collapsed" : "expanded"
      );
      return next;
    });
  }, []);

  return (
    <aside
      className={`
        hidden lg:flex flex-col h-screen fixed left-0 top-0
        bg-stone-50/40 backdrop-blur-xl border-r border-stone-200
        transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        overflow-hidden z-20
        ${collapsed ? "w-16" : "w-64"}
      `}
    >
      {/* Logo Section */}
      <div
        className={`
          border-b border-stone-200 flex items-center
          transition-all duration-300
          ${collapsed ? "px-3 py-5 justify-center" : "px-6 py-8"}
        `}
      >
        <Link href="/" className="flex items-center gap-3 group min-w-0">
          <Image
            src="/assets/logo/logo_svg.svg"
            alt="Sisyphus"
            width={56}
            height={56}
            className="shrink-0 group-hover:scale-105 transition-transform duration-300"
          />
          {/* Name — hidden when collapsed */}
          <div
            className={`
              overflow-hidden transition-all duration-300
              ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}
            `}
          >
            <h1 className="text-lg font-semibold text-stone-800 tracking-wide whitespace-nowrap">
              Sisyphus
            </h1>
            <p className="text-xs text-stone-400 tracking-wider uppercase whitespace-nowrap">
              Privacy Tools
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 py-6 ${collapsed ? "px-2" : "px-4"}`}>
        <div className="space-y-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive =
              pathname === href ||
              (href !== "/" && pathname.startsWith(href));

            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={`
                  flex items-center rounded-xl
                  transition-all duration-200 group
                  ${collapsed ? "justify-center p-3" : "gap-3 px-4 py-3"}
                  ${
                    isActive
                      ? "bg-stone-100 text-stone-900 border border-stone-200"
                      : "text-stone-500 hover:text-stone-800 hover:bg-stone-50 border border-transparent"
                  }
                `}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 ${
                    isActive
                      ? "text-stone-700"
                      : "text-stone-400 group-hover:text-stone-600"
                  }`}
                />
                {/* Label — hidden when collapsed */}
                <span
                  className={`
                    font-medium whitespace-nowrap overflow-hidden transition-all duration-300
                    ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}
                  `}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer: Quote (expanded) + Collapse toggle */}
      <div className={`border-t border-stone-200 ${collapsed ? "p-3" : "px-6 py-5"}`}>
        {/* Quote — only shown when expanded */}
        {!collapsed && (
          <div className="mb-4 overflow-hidden">
            <p className="text-xs text-stone-500 italic leading-relaxed">
              &quot;One must imagine Sisyphus happy.&quot;
            </p>
            <p className="text-xs text-stone-400 mt-1">— Camus</p>
          </div>
        )}

        {/* Toggle button */}
        <button
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`
            flex items-center justify-center rounded-xl
            text-stone-400 hover:text-stone-700 hover:bg-stone-100
            transition-all duration-200 border border-transparent hover:border-stone-200
            ${collapsed ? "w-10 h-10 mx-auto" : "w-full py-2 gap-2 px-3"}
          `}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4" />
              <span className="text-xs font-medium whitespace-nowrap">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
