"use client";

import { useRef, useState, useCallback, useEffect, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface ToolTab<T extends string = string> {
  id: T;
  label: string;
  description: string;
  icon: ReactNode;
}

interface ToolCarouselProps<T extends string> {
  tabs: ToolTab<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
}

/**
 * Horizontal scrollable carousel for tool tab selection.
 * Compact design that works well on both mobile and desktop.
 */
export function ToolCarousel<T extends string>({
  tabs,
  activeTab,
  onTabChange,
}: ToolCarouselProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll state
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();
    el.addEventListener("scroll", updateScrollState);
    window.addEventListener("resize", updateScrollState);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  // Scroll to active tab on mount/change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const activeIndex = tabs.findIndex((t) => t.id === activeTab);
    const tabElements = el.querySelectorAll("[data-tab]");
    const activeElement = tabElements[activeIndex] as HTMLElement | undefined;

    if (activeElement) {
      const elRect = el.getBoundingClientRect();
      const tabRect = activeElement.getBoundingClientRect();

      // Center the active tab if it's not fully visible
      if (tabRect.left < elRect.left || tabRect.right > elRect.right) {
        const scrollTarget = activeElement.offsetLeft - el.clientWidth / 2 + activeElement.clientWidth / 2;
        el.scrollTo({ left: scrollTarget, behavior: "smooth" });
      }
    }
  }, [activeTab, tabs]);

  const scroll = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;

    const scrollAmount = 200;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  }, []);

  return (
    <div className="relative">
      {/* Left scroll button */}
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-surface/90 shadow-md border border-border text-secondary hover:bg-surface hover:text-primary transition-colors"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide px-1 py-1 -mx-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-tab={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              shrink-0 flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all duration-200
              ${activeTab === tab.id
                ? "border-border-strong bg-surface shadow-sm"
                : "border-border bg-surface-subtle hover:border-border-strong hover:bg-surface"
              }
            `}
          >
            <span
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                activeTab === tab.id
                  ? "bg-primary text-canvas"
                  : "bg-surface-muted text-secondary"
              }`}
            >
              {tab.icon}
            </span>
            <div className="text-left">
              <div className="text-sm font-semibold text-primary whitespace-nowrap">
                {tab.label}
              </div>
              <div className="text-xs text-secondary whitespace-nowrap">
                {tab.description}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Right scroll button */}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-surface/90 shadow-md border border-border text-secondary hover:bg-surface hover:text-primary transition-colors"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
