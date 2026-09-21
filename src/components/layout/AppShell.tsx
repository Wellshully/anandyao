import type { ReactNode } from "react";

import SiteHeader from "@/components/layout/SiteHeader";
import Container from "@/components/ui/Container";

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <Container className="py-8 sm:py-10">{children}</Container>
    </div>
  );
}
