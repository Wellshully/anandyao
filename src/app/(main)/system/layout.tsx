import type { ReactNode } from "react";

import { notFound } from "next/navigation";

import {
  getCurrentSpaceRole,
} from "@/features/profile/lib/get-current-space-role";

type SystemLayoutProps = {
  children: ReactNode;
};

export default async function SystemLayout({
  children,
}: SystemLayoutProps) {
  const role = await getCurrentSpaceRole();

  if (role !== "owner") {
    notFound();
  }

  return <>{children}</>;
}
