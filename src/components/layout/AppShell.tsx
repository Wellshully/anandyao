import type { ReactNode } from "react";

import SiteHeader from "@/components/layout/SiteHeader";

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-white text-neutral-950">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
