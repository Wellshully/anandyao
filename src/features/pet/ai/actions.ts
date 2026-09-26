"use server";

import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import {
  PET_CONVERSATION_MAX_MESSAGES,
  trimPetConversation,
  type PetConversationMessage,
} from "@/features/pet/ai/conversation";
import { talkToPet } from "@/features/pet/ai/talk-to-pet";

import type { PetReply } from "@/features/pet/ai/pet-reply";

const conversationSchema = z
  .array(
    z.object({
      role: z.enum(["user", "pet"]),
      content: z.string().min(1).max(500),
    }),
  )
  .max(PET_CONVERSATION_MAX_MESSAGES);

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
  conversation: PetConversationMessage[] = [],
): Promise<TalkToPetResult> {
  try {
    const parsedConversation = conversationSchema.parse(conversation);

    const safeConversation = trimPetConversation(parsedConversation);

    const reply = await talkToPet(message, safeConversation);

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
