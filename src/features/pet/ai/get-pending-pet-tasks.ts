import "server-only";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

import { getPet } from "@/features/pet/lib/get-pet";

export type PendingPetTask = {
  id: string;
  title: string;
  note: string | null;
  dueAt: string | null;
  createdAt: string;
};

export async function getPendingPetTasks(): Promise<PendingPetTask[]> {
  const [user, supabase, pet] = await Promise.all([
    requireUser(),
    createClient(),
    getPet(),
  ]);

  const { data, error } = await supabase
    .from("pet_tasks")
    .select(
      `
        id,
        title,
        note,
        due_at,
        created_at
      `,
    )
    .eq("pet_id", pet.id)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", {
      ascending: false,
    })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((item) => ({
      id: item.id,
      title: item.title,
      note: item.note,
      dueAt: item.due_at,
      createdAt: item.created_at,
    }))
    .sort((a, b) => {
      if (a.dueAt && b.dueAt) {
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      }

      if (a.dueAt) {
        return -1;
      }

      if (b.dueAt) {
        return 1;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 12);
}
