import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireSpace } from "@/lib/space/require-space";

import { requireUser } from "@/lib/auth/require-user";

export async function setPersonalPlanCompleted(
  planId: string,
  completed: boolean,
) {
  const [supabase, space, user] = await Promise.all([
    createClient(),
    requireSpace(),
    requireUser(),
  ]);

  const { data, error } = await supabase
    .from("personal_plans")
    .update({
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", planId)
    .eq("space_id", space.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update personal plan: ${error.message}`);
  }

  if (!data) {
    throw new Error("找不到這個計畫。");
  }
}
