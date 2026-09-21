"use server";

import { redirect } from "next/navigation";

import { siteConfig } from "@/config/site";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

export async function setupSpace(formData: FormData) {
  const user = await requireUser();

  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!displayName) {
    redirect("/setup?error=name");
  }

  const supabase = await createClient();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
    })
    .eq("id", user.id);

  if (profileError) {
    throw profileError;
  }

  const { error: spaceError } = await supabase.rpc("claim_initial_space", {
    space_name: siteConfig.space.name,
    space_slug: siteConfig.space.slug,
  });

  if (spaceError) {
    throw spaceError;
  }

  redirect("/");
}
