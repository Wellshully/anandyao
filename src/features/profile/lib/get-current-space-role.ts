import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CurrentSpaceRole = "owner" | "member";

export async function getCurrentSpaceRole(): Promise<CurrentSpaceRole> {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return "member";
  }

  const { data, error } = await supabase
    .from("space_members")
    .select("role")
    .eq("user_id", authData.user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getCurrentSpaceRole:", error);

    return "member";
  }

  return data?.role === "owner" ? "owner" : "member";
}
