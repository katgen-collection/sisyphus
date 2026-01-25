"use client";

import { Home, Video, FileText } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/video", icon: Video, label: "Video" },
  { href: "/pdf", icon: FileText, label: "PDF" },
];

/**
 * Sidebar navigation for desktop view.
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen fixed left-0 top-0 bg-white/90 backdrop-blur-xl border-r border-stone-200">
      {/* Logo Section */}
      <div className="px-6 py-8 border-b border-stone-200">
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/assets/logo/logo_svg.svg"
            alt="Sisyphus"
            width={56}
            height={56}
            className="group-hover:scale-105 transition-transform duration-300"
          />
          <div>
            <h1 className="text-lg font-semibold text-stone-800 tracking-wide">
              Sisyphus
            </h1>
            <p className="text-xs text-stone-400 tracking-wider uppercase">
              Privacy Tools
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6">
        <div className="space-y-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl
                  transition-all duration-200 group
                  ${isActive 
                    ? "bg-stone-100 text-stone-900 border border-stone-200" 
                    : "text-stone-500 hover:text-stone-800 hover:bg-stone-50"
                  }
                `}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-stone-700" : "text-stone-400 group-hover:text-stone-600"}`} />
                <span className="font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer Quote */}
      <div className="px-6 py-6 border-t border-stone-200">
        <p className="text-xs text-stone-500 italic leading-relaxed">
          "One must imagine Sisyphus happy."
        </p>
        <p className="text-xs text-stone-400 mt-1">— Camus</p>
      </div>
    </aside>
  );
}
