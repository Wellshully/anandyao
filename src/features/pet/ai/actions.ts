"use server";

import { unstable_rethrow } from "next/navigation";

import { talkToPet } from "@/features/pet/ai/talk-to-pet";

import type { PetReply } from "@/features/pet/ai/pet-reply";

type TalkToPetResult =
  | {
      success: true;
      reply: PetReply;
    }
  | {
      success: false;
      error: string;
    };

export async function talkToPetAction(
  message: string,
): Promise<TalkToPetResult> {
  try {
    const reply = await talkToPet(message);

    return {
      success: true,
      reply,
    };
  } catch (cause) {
    unstable_rethrow(cause);

    console.error(
      "Talk to pet failed:",
      cause instanceof Error ? cause.message : cause,
    );

    return {
      success: false,
      error:
        cause instanceof Error
          ? cause.message
          : "Pet is unavailable right now.",
    };
  }
}
