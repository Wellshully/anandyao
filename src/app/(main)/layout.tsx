import type { ReactNode } from "react";

import AppShell from "@/components/layout/AppShell";
import { requireUser } from "@/lib/auth/require-user";
import { requireSpace } from "@/lib/space/require-space";

export const dynamic = "force-dynamic";

type MainLayoutProps = {
  children: ReactNode;
};

export default async function MainLayout({ children }: MainLayoutProps) {
  await requireUser();
  await requireSpace();

  return <AppShell>{children}</AppShell>;
}
