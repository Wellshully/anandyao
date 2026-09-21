import { createClient } from "@/lib/supabase/server";

export async function getCurrentSpace() {
  const supabase = await createClient();

  const { data: membership, error } = await supabase
    .from("space_members")
    .select(
      `
        space_id,
        role,
        spaces (
          id,
          name,
          slug
        )
      `,
    )
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!membership || !membership.spaces) {
    return null;
  }

  return {
    id: membership.spaces.id,
    name: membership.spaces.name,
    slug: membership.spaces.slug,
    role: membership.role,
  };
}
