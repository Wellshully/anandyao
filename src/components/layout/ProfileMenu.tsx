"use client";

import { useState } from "react";

import { signOut } from "@/app/auth/actions";

type ProfileMenuProps = {
  displayName: string;
};

export default function ProfileMenu({ displayName }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const initial = displayName.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-label="Profile"
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
            w-56
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

          <p className="mt-4 text-xs text-[var(--muted)]">你是</p>

          <p className="font-story mt-1 text-xl font-semibold">{displayName}</p>

          <p className="mt-1 text-xs text-[var(--muted)]">An & Yao</p>

          <div className="my-4 border-t border-[var(--border)]" />

          <form action={signOut}>
            <button
              type="submit"
              className="
                w-full
                rounded-xl
                border
                border-[var(--border)]
                px-3
                py-2.5
                text-left
                text-sm
                text-[var(--muted)]
                transition
                hover:border-[var(--foreground)]
                hover:text-[var(--foreground)]
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
