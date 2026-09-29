"use client";

import { useEffect, useRef, useState } from "react";

import { signOut } from "@/app/auth/actions";
import InteractionSettings from "@/features/interactions/components/InteractionSettings";
import ThemeSwitcher from "@/features/appearance/components/ThemeSwitcher";
import type { ProjectUsage } from "@/features/profile/usage-types";
import NotificationSettings from "@/features/notifications/components/NotificationSettings";
type ProfileMenuProps = {
  displayName: string;
  isOwner: boolean;
  usage: ProjectUsage | null;
  interactionActionName: string;
};
const STORAGE_LIMIT = 1_000_000_000;

const DATABASE_LIMIT = 500_000_000;

function formatBytes(bytes: number) {
  if (bytes < 1_000_000) {
    return `${(bytes / 1_000).toFixed(0)} KB`;
  }

  if (bytes < 1_000_000_000) {
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
  }

  return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
}

function UsageRow({
  label,
  used,
  limit,
  limitLabel,
}: {
  label: string;
  used: number;
  limit: number;
  limitLabel: string;
}) {
  const percent = Math.min(100, Math.max(0, (used / limit) * 100));

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-[11px] text-[var(--muted)]">{label}</p>

        <p className="text-[10px] tabular-nums text-[var(--muted)]">
          {formatBytes(used)} / {limitLabel}
        </p>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--surface-soft)]">
        <div
          className={`
            h-full
            rounded-full

            ${percent >= 80 ? "bg-[var(--danger)]" : "bg-[var(--accent)]"}
          `}
          style={{
            width: `${percent}%`,
          }}
        />
      </div>
    </div>
  );
}
export default function ProfileMenu({
  displayName,
  isOwner,
  usage,
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
          {isOwner && usage && (
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
                System
              </summary>

              <div className="mt-4 space-y-4">
                <UsageRow
                  label="Files"
                  used={usage.storageBytes}
                  limit={STORAGE_LIMIT}
                  limitLabel="1 GB"
                />

                <UsageRow
                  label="Database"
                  used={usage.databaseBytes}
                  limit={DATABASE_LIMIT}
                  limitLabel="500 MB"
                />
              </div>
            </details>
          )}

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
