"use client";

import Link from "next/link";

import type { ReactNode } from "react";

import {
  OPEN_PERSONAL_PANEL_EVENT,
  getPersonalPlanIdFromHomeItem,
} from "@/features/today/lib/personal-panel-navigation";

type Props = {
  kind: string | null;
  itemId: string | null;
  href: string;
  className: string;
  children: ReactNode;
};

export default function HomeNextUpAction({
  kind,
  itemId,
  href,
  className,
  children,
}: Props) {
  if (kind === "personal") {
    return (
      <button
        type="button"
        className={`${className} w-full text-left`}
        onClick={() => {
          const planId = getPersonalPlanIdFromHomeItem(
            kind,
            itemId,
          );

          window.dispatchEvent(
            new CustomEvent(OPEN_PERSONAL_PANEL_EVENT, {
              detail: { planId },
            }),
          );
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
