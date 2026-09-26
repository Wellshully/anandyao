import "server-only";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

import type { PetMemoryCandidate } from "@/features/pet/ai/pet-reply";
import { getPet } from "@/features/pet/lib/get-pet";

const TEMPORARY_MEMORY_DAYS = 30;

function normalizeMemoryContent(content: string) {
  return content
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function getExpiresAt(importance: number) {
  if (importance !== 1) {
    return null;
  }

  const expiresAt = new Date();

  expiresAt.setDate(expiresAt.getDate() + TEMPORARY_MEMORY_DAYS);

  return expiresAt.toISOString();
}

export async function savePetMemory(memory: PetMemoryCandidate) {
  const user = await requireUser();
  const supabase = await createClient();
  const pet = await getPet();

  /*
   * Resolve who this memory is about.
   *
   * current_user -> current logged-in user
   * partner      -> the other member of the space
   * shared       -> no single subject
   */
  let subjectUserId: string | null = null;

  if (memory.subject === "current_user") {
    subjectUserId = user.id;
  }

  if (memory.subject === "partner") {
    const { data: partner, error: partnerError } = await supabase
      .from("space_members")
      .select("user_id")
      .eq("space_id", pet.spaceId)
      .neq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (partnerError) {
      throw new Error(partnerError.message);
    }

    /*
     * Do not save a memory about "the partner"
     * if no partner can actually be resolved.
     */
    if (!partner) {
      return;
    }

    subjectUserId = partner.user_id;
  }

  /*
   * Remove expired temporary memories while
   * we are already handling a pet conversation.
   *
   * No cron job is needed.
   */
  const now = new Date().toISOString();

  const { error: cleanupError } = await supabase
    .from("pet_memories")
    .delete()
    .eq("pet_id", pet.id)
    .lt("expires_at", now);

  if (cleanupError) {
    console.warn("Failed to clean expired pet memories:", cleanupError.message);
  }

  /*
   * Load only memories with the same semantic
   * category and subject for cheap duplicate
   * detection.
   */
  let duplicateQuery = supabase
    .from("pet_memories")
    .select(
      `
        id,
        content,
        importance,
        expires_at
      `,
    )
    .eq("pet_id", pet.id)
    .eq("memory_type", memory.type)
    .order("created_at", {
      ascending: false,
    })
    .limit(50);

  if (subjectUserId === null) {
    duplicateQuery = duplicateQuery.is("subject_user_id", null);
  } else {
    duplicateQuery = duplicateQuery.eq("subject_user_id", subjectUserId);
  }

  const { data: existingMemories, error: existingMemoriesError } =
    await duplicateQuery;

  if (existingMemoriesError) {
    throw new Error(existingMemoriesError.message);
  }

  const normalizedCandidate = normalizeMemoryContent(memory.content);

  const duplicate = (existingMemories ?? []).find(
    (item) => normalizeMemoryContent(item.content) === normalizedCandidate,
  );

  /*
   * If the same memory already exists, do not
   * create another row.
   *
   * Repeated information may promote an existing
   * memory to a higher importance.
   */
  if (duplicate) {
    const finalImportance = Math.max(duplicate.importance, memory.importance);

    const { error: updateError } = await supabase
      .from("pet_memories")
      .update({
        importance: finalImportance,
        expires_at: getExpiresAt(finalImportance),
        updated_at: now,
      })
      .eq("id", duplicate.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return;
  }

  const { error: insertError } = await supabase.from("pet_memories").insert({
    pet_id: pet.id,
    subject_user_id: subjectUserId,
    created_by: user.id,
    memory_type: memory.type,
    content: memory.content.trim(),
    importance: memory.importance,
    expires_at: getExpiresAt(memory.importance),
  });

  if (insertError) {
    throw new Error(insertError.message);
  }
}
