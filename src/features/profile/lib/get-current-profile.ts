import "server-only";

import { createClient } from "@/lib/supabase/server";

import { requireUser } from "@/lib/auth/require-user";

export type HeaderProfile = {
  id: string;
  displayName: string;
};

export async function getCurrentProfile(): Promise<HeaderProfile> {
  const [supabase, user] = await Promise.all([createClient(), requireUser()]);

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load profile: ${error.message}`);
  }

  return {
    id: user.id,

    displayName: data?.display_name?.trim() || "Member",
  };
}
