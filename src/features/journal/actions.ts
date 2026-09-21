"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isJournalStatus } from "@/features/journal/config/journal-status";
import { requireUser } from "@/lib/auth/require-user";
import { requireSpace } from "@/lib/space/require-space";
import { createClient } from "@/lib/supabase/server";

function getJournalFormData(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();

  const content = String(formData.get("content") ?? "").trim();

  const entryDate = String(formData.get("entryDate") ?? "");

  const status = String(formData.get("status") ?? "");

  if (!title || !content || !entryDate || !isJournalStatus(status)) {
    return null;
  }

  return {
    title,
    content,
    entry_date: entryDate,
    status,
  };
}

export async function createJournalEntry(formData: FormData) {
  const user = await requireUser();

  const space = await requireSpace();

  const values = getJournalFormData(formData);

  if (!values) {
    redirect("/journal/new?error=invalid");
  }

  const supabase = await createClient();

  const publishedAt =
    values.status === "published" ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from("journal_entries")
    .insert({
      space_id: space.id,
      author_id: user.id,

      title: values.title,
      content: values.content,
      entry_date: values.entry_date,

      status: values.status,
      published_at: publishedAt,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  redirect(`/journal/${data.id}`);
}

export async function updateJournalEntry(formData: FormData) {
  const user = await requireUser();

  const space = await requireSpace();

  const entryId = String(formData.get("entryId") ?? "");

  const values = getJournalFormData(formData);

  if (!entryId || !values) {
    return;
  }

  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("journal_entries")
    .select(
      `
      status,
      published_at
    `,
    )
    .eq("id", entryId)
    .eq("space_id", space.id)
    .eq("author_id", user.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    return;
  }

  let publishedAt = existing.published_at;

  if (values.status === "published" && existing.status === "draft") {
    publishedAt = new Date().toISOString();
  }

  if (values.status === "draft") {
    publishedAt = null;
  }

  const { error } = await supabase
    .from("journal_entries")
    .update({
      ...values,
      published_at: publishedAt,
    })
    .eq("id", entryId)
    .eq("space_id", space.id)
    .eq("author_id", user.id);

  if (error) {
    throw error;
  }

  revalidatePath("/journal");

  revalidatePath(`/journal/${entryId}`);

  redirect(`/journal/${entryId}`);
}

export async function deleteJournalEntry(formData: FormData) {
  const user = await requireUser();

  const space = await requireSpace();

  const entryId = String(formData.get("entryId") ?? "");

  if (!entryId) {
    return;
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("journal_entries")
    .delete()
    .eq("id", entryId)
    .eq("space_id", space.id)
    .eq("author_id", user.id);

  if (error) {
    throw error;
  }

  revalidatePath("/journal");

  redirect("/journal");
}
