import "server-only";

import { notFound } from "next/navigation";

import {
  getCurrentSpaceRole,
} from "@/features/profile/lib/get-current-space-role";

export async function requireSystemOwner() {
  const role = await getCurrentSpaceRole();

  if (role !== "owner") {
    notFound();
  }
}
