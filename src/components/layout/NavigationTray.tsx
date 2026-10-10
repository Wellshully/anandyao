"use client";

import Link from "next/link";

import { usePathname } from "next/navigation";

import { useEffect, useRef, useState } from "react";

import { siteConfig } from "@/config/site";

export default function NavigationTray() {
  const pathname = usePathname();

  const containerRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);

  // Keep the existing navigation order and add
  // System as the final item in the top menu.
  const baseNavigationItems = siteConfig.navigation.slice(1);

  const navigationItems = baseNavigationItems.some(
    (item) => String(item.href) === "/system",
  )
    ? baseNavigationItems
    : [
        ...baseNavigationItems,
        { href: "/system", label: "System" },
      ];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-label="功能選單"
        className="
          flex
          h-9
          w-9
          items-center
          justify-center
          rounded-xl
          border
          border-[var(--border)]
          bg-[var(--surface)]
          transition
          hover:border-[var(--foreground)]
          hover:bg-[var(--surface-soft)]
        "
      >
        <span
          className="
            grid
            grid-cols-2
            gap-[3px]
          "
          aria-hidden="true"
        >
          <span className="h-[4px] w-[4px] rounded-full bg-current" />
          <span className="h-[4px] w-[4px] rounded-full bg-current" />
          <span className="h-[4px] w-[4px] rounded-full bg-current" />
          <span className="h-[4px] w-[4px] rounded-full bg-current" />
        </span>
      </button>

      {isOpen && (
        <div
          className="
            fixed
            left-4
            right-4
            top-[4.75rem]
            z-50
            overflow-hidden
            rounded-[var(--radius-lg)]
            border
            border-[var(--border)]
            bg-[var(--surface)]
            shadow-[0_20px_60px_rgba(38,35,31,0.12)]

            sm:absolute
            sm:left-auto
            sm:right-0
            sm:top-[calc(100%+0.75rem)]
            sm:w-80
          "
        >
          <div className="border-b border-[var(--border)] px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
              Our things
            </p>

            <p className="font-story mt-1 text-xl font-semibold">所有功能</p>
          </div>

          <nav className="grid grid-cols-2 gap-px bg-[var(--border)]">
            {navigationItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex
                    min-h-20
                    items-center
                    justify-between
                    gap-3
                    bg-[var(--surface)]
                    px-4
                    py-4
                    text-sm
                    transition

                    ${
                      isActive
                        ? "font-medium text-[var(--foreground)]"
                        : "text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
                    }
                  `}
                >
                  <span>{item.label}</span>

                  <span
                    className="
                      text-xs
                      opacity-50
                    "
                    aria-hidden="true"
                  >
                    →
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
