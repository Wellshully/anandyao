"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { requireSpace } from "@/lib/space/require-space";
import { createClient } from "@/lib/supabase/server";

export async function createMemory(formData: FormData) {
  await requireUser();

  const space = await requireSpace();

  const title = String(formData.get("title") ?? "").trim();

  const body = String(formData.get("body") ?? "").trim();

  const memoryDate = String(formData.get("memoryDate") ?? "");

  const locationName = String(formData.get("locationName") ?? "").trim();

  if (!title || !memoryDate) {
    redirect("/memories/new?error=missing");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("memories")
    .insert({
      space_id: space.id,
      title,
      body: body || null,
      memory_date: memoryDate,
      location_name: locationName || null,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  redirect(`/memories/${data.id}`);
}
