"use client";

import { useEffect, useRef, useState } from "react";

import { signOut } from "@/app/auth/actions";
import InteractionSettings from "@/features/interactions/components/InteractionSettings";
import ThemeSwitcher from "@/features/appearance/components/ThemeSwitcher";
import NotificationSettings from "@/features/notifications/components/NotificationSettings";
type ProfileMenuProps = {
  displayName: string;
  interactionActionName: string;
};
export default function ProfileMenu({
  displayName,
  interactionActionName,
}: ProfileMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);

  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

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
        className="
          flex
          h-9
          w-9
          items-center
          justify-center
          rounded-full
          border
          border-[var(--border)]
          bg-[var(--surface)]
          text-sm
          font-medium
          transition
          hover:border-[var(--foreground)]
        "
        aria-expanded={isOpen}
        aria-label="Profile"
      >
        {initial}
      </button>

      {isOpen && (
        <div
          className="
            absolute
            right-0
            top-[calc(100%+0.75rem)]
            z-50
            max-h-[calc(100vh-6rem)]
            w-80
            overflow-y-auto
            rounded-[var(--radius-md)]
            border
            border-[var(--border)]
            bg-[var(--surface)]
            p-4
            shadow-[0_20px_60px_rgba(38,35,31,0.12)]
          "
        >
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
            Profile
          </p>
          <div className="mt-3">
            <p className="font-story text-xl font-semibold">{displayName}</p>

            <p className="mt-1 text-xs text-[var(--muted)]">An & Yao</p>
          </div>

          <details className="mt-5 border-t border-[var(--border)] pt-4">
            <summary
              className="
                cursor-pointer
                select-none
                text-[10px]
                uppercase
                tracking-[0.2em]
                text-[var(--muted)]
              "
            >
              Theme
            </summary>

            <div className="mt-3">
              <ThemeSwitcher compact />
            </div>
          </details>

          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
              Notifications
            </p>

            <NotificationSettings />
          </div>
          <InteractionSettings initialActionName={interactionActionName} />

          <form
            action={signOut}
            className="mt-5 border-t border-[var(--border)] pt-4"
          >
            <button
              type="submit"
              className="
                w-full
                rounded-xl
                border
                border-[var(--border)]
                px-4
                py-2.5
                text-sm
                transition
                hover:border-[var(--foreground)]
              "
            >
              Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
