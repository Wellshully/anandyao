import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireSpace } from "@/lib/space/require-space";

import { requireUser } from "@/lib/auth/require-user";

export async function deletePersonalPlan(planId: string) {
  const [supabase, space, user] = await Promise.all([
    createClient(),
    requireSpace(),
    requireUser(),
  ]);

  const { data, error } = await supabase
    .from("personal_plans")
    .delete()
    .eq("id", planId)
    .eq("space_id", space.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to delete personal plan: ${error.message}`);
  }

  if (!data) {
    throw new Error("找不到這個計畫。");
  }
}
