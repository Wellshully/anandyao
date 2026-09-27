"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isPlaceStatus } from "@/features/places/config/place-status";
import { requireUser } from "@/lib/auth/require-user";
import { requireSpace } from "@/lib/space/require-space";
import { createClient } from "@/lib/supabase/server";

function getPlaceFormData(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();

  const status = String(formData.get("status") ?? "");

  const address = String(formData.get("address") ?? "").trim();

  const note = String(formData.get("note") ?? "").trim();

  const visitedOn = String(formData.get("visitedOn") ?? "");

  if (!name || !isPlaceStatus(status)) {
    return null;
  }

  return {
    name,
    status,
    address: address || null,
    note: note || null,
    visited_on: visitedOn || null,
  };
}

export async function createPlace(formData: FormData) {
  await requireUser();

  const space = await requireSpace();

  const values = getPlaceFormData(formData);

  if (!values) {
    redirect("/places/new?error=invalid");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("places")
    .insert({
      space_id: space.id,
      ...values,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  redirect(`/places/${data.id}`);
}

export async function updatePlace(formData: FormData) {
  await requireUser();

  const space = await requireSpace();

  const placeId = String(formData.get("placeId") ?? "");

  const values = getPlaceFormData(formData);

  if (!placeId || !values) {
    return;
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("places")
    .update(values)
    .eq("id", placeId)
    .eq("space_id", space.id);

  if (error) {
    throw error;
  }

  revalidatePath("/places");
  revalidatePath(`/places/${placeId}`);

  redirect(`/places`);
}

export async function deletePlace(formData: FormData) {
  await requireUser();

  const space = await requireSpace();

  const placeId = String(formData.get("placeId") ?? "");

  if (!placeId) {
    return;
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("places")
    .delete()
    .eq("id", placeId)
    .eq("space_id", space.id);

  if (error) {
    throw error;
  }

  revalidatePath("/places");

  redirect("/places");
}
