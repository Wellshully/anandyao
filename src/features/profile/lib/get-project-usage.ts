import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { ProjectUsage } from "@/features/profile/usage-types";

export async function getProjectUsage(): Promise<ProjectUsage | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_project_usage");

  if (error) {
    console.error("getProjectUsage:", error);

    /*
     * Usage information should never
     * break the whole SiteHeader.
     */
    return null;
  }

  const row = data?.[0];

  if (!row) {
    return null;
  }

  return {
    storageBytes: Number(row.storage_bytes),

    databaseBytes: Number(row.database_bytes),
  };
}
