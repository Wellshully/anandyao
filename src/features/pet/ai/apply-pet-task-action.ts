import "server-only";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

import { getPet } from "@/features/pet/lib/get-pet";
import { savePetTask } from "@/features/pet/ai/save-pet-task";

import type { PetTaskActionCandidate } from "@/features/pet/ai/pet-reply";

export async function applyPetTaskAction(action: PetTaskActionCandidate) {
  /*
   * New task.
   */
  if (action.action === "create") {
    if (!action.task) {
      return;
    }

    await savePetTask(action.task);

    return;
  }

  if (!action.taskId) {
    return;
  }

  const [user, supabase, pet] = await Promise.all([
    requireUser(),
    createClient(),
    getPet(),
  ]);

  /*
   * completed / cancelled tasks do not need
   * permanent history in the current product.
   *
   * Delete them immediately so pet_tasks stays
   * limited to active pending tasks.
   */
  const { data, error } = await supabase
    .from("pet_tasks")
    .delete()
    .eq("id", action.taskId)
    .eq("pet_id", pet.id)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  /*
   * The task may already have been removed.
   */
  if (!data) {
    return;
  }

  revalidatePath("/pet");
}
