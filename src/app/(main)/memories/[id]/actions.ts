"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { requireSpace } from "@/lib/space/require-space";
import { createClient } from "@/lib/supabase/server";

export async function updateMemory(formData: FormData) {
  await requireUser();

  const space = await requireSpace();

  const memoryId = String(formData.get("memoryId") ?? "");

  const title = String(formData.get("title") ?? "").trim();

  const body = String(formData.get("body") ?? "").trim();

  const memoryDate = String(formData.get("memoryDate") ?? "");

  const locationName = String(formData.get("locationName") ?? "").trim();

  if (!memoryId || !title || !memoryDate) {
    return;
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("memories")
    .update({
      title,
      body: body || null,
      memory_date: memoryDate,
      location_name: locationName || null,
    })
    .eq("id", memoryId)
    .eq("space_id", space.id);

  if (error) {
    throw error;
  }

  revalidatePath("/memories");
  revalidatePath(`/memories/${memoryId}`);

  redirect(`/memories/${memoryId}`);
}

export async function deleteMemory(formData: FormData) {
  await requireUser();

  const space = await requireSpace();

  const memoryId = String(formData.get("memoryId") ?? "");

  if (!memoryId) {
    return;
  }

  const supabase = await createClient();

  const { data: links } = await supabase
    .from("memory_media")
    .select("media_id")
    .eq("memory_id", memoryId);

  const mediaIds = links?.map((link) => link.media_id) ?? [];

  let storagePaths: string[] = [];

  if (mediaIds.length > 0) {
    const { data: media } = await supabase
      .from("media")
      .select("id, storage_path")
      .eq("space_id", space.id)
      .in("id", mediaIds);

    storagePaths = media?.map((item) => item.storage_path) ?? [];
  }

  const { error: memoryError } = await supabase
    .from("memories")
    .delete()
    .eq("id", memoryId)
    .eq("space_id", space.id);

  if (memoryError) {
    throw memoryError;
  }

  if (mediaIds.length > 0) {
    await supabase.from("media").delete().in("id", mediaIds);
  }

  if (storagePaths.length > 0) {
    const { error } = await supabase.storage.from("media").remove(storagePaths);

    if (error) {
      console.error("Storage cleanup failed:", error);
    }
  }

  revalidatePath("/memories");

  redirect("/memories");
}

export async function deleteMemoryPhoto(formData: FormData) {
  await requireUser();
  await requireSpace();

  const memoryId = String(formData.get("memoryId") ?? "");

  const mediaId = String(formData.get("mediaId") ?? "");

  if (!memoryId || !mediaId) {
    return;
  }

  const supabase = await createClient();

  const { data: media } = await supabase
    .from("media")
    .select("storage_path")
    .eq("id", mediaId)
    .single();

  const { error: linkError } = await supabase
    .from("memory_media")
    .delete()
    .eq("memory_id", memoryId)
    .eq("media_id", mediaId);

  if (linkError) {
    throw linkError;
  }

  const { error: mediaError } = await supabase
    .from("media")
    .delete()
    .eq("id", mediaId);

  if (mediaError) {
    throw mediaError;
  }

  if (media?.storage_path) {
    const { error } = await supabase.storage
      .from("media")
      .remove([media.storage_path]);

    if (error) {
      console.error("Storage cleanup failed:", error);
    }
  }

  revalidatePath(`/memories/${memoryId}`);
}
