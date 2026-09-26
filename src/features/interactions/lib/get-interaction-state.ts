import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";

const DEFAULT_ACTION_NAME = "戳一下";

const COOLDOWN_SECONDS = 60;

export type InteractionState = {
  actionName: string;
  cooldownSeconds: number;
};

export async function getInteractionState(): Promise<InteractionState> {
  const [supabase, user] = await Promise.all([createClient(), requireUser()]);

  const { data, error } = await supabase
    .from("interaction_settings")
    .select("action_name, last_sent_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load interaction settings: ${error.message}`);
  }

  const actionName = data?.action_name?.trim() || DEFAULT_ACTION_NAME;

  if (!data?.last_sent_at) {
    return {
      actionName,
      cooldownSeconds: 0,
    };
  }

  const elapsedMs = Date.now() - new Date(data.last_sent_at).getTime();

  const remainingMs = COOLDOWN_SECONDS * 1000 - elapsedMs;

  return {
    actionName,

    cooldownSeconds: remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0,
  };
}
