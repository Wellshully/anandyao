"use server";

import { unstable_rethrow } from "next/navigation";

import { z } from "zod";

import {
  PET_CONVERSATION_MAX_MESSAGES,
  trimPetConversation,
  type PetConversationMessage,
} from "@/features/pet/ai/conversation";

import { talkToPet } from "@/features/pet/ai/talk-to-pet";

import { savePetMemory } from "@/features/pet/ai/save-pet-memory";

import { applyPetTaskAction } from "@/features/pet/ai/apply-pet-task-action";

import type { PetReply } from "@/features/pet/ai/pet-reply";

const conversationSchema = z
  .array(
    z.object({
      role: z.enum(["user", "pet"]),

      content: z.string().min(1).max(500),

      /*
       * optional keeps compatibility with older
       * browser state.
       *
       * We normalize undefined to null below.
       */
      createdAt: z.string().datetime().nullable().optional(),
    }),
  )
  .max(PET_CONVERSATION_MAX_MESSAGES);

function normalizeSemanticText(
  value: string,
) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(
      /[\s\p{P}\p{S}]+/gu,
      "",
    );
}

function memoryOverlapsCreatedTask(
  memoryContent: string,
  taskActions: PetReply["taskActions"],
) {
  const normalizedMemory =
    normalizeSemanticText(
      memoryContent,
    );

  return taskActions.some(
    (action) => {
      if (
        action.action !== "create" ||
        !action.task
      ) {
        return false;
      }

      const candidates = [
        action.task.title,
        action.task.note,
      ]
        .filter(
          (
            value,
          ): value is string =>
            Boolean(value),
        )
        .map(
          normalizeSemanticText,
        )
        .filter(
          (value) =>
            value.length >= 2,
        );

      return candidates.some(
        (candidate) =>
          normalizedMemory.includes(
            candidate,
          ) ||
          candidate.includes(
            normalizedMemory,
          ),
      );
    },
  );
}

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

    /*
     * Normalize historical messages that were
     * stored before createdAt was introduced.
     */
    const normalizedConversation: PetConversationMessage[] =
      parsedConversation.map((item) => ({
        role: item.role,

        content: item.content,

        createdAt: item.createdAt ?? null,
      }));

    const safeConversation = trimPetConversation(normalizedConversation);

    const reply = await talkToPet(message, safeConversation);

    /*
     * Memory persistence is best-effort.
     */
    const shouldSaveMemory =
      Boolean(reply.memory) &&
      !(
        reply.memory?.type ===
          "temporary" &&
        memoryOverlapsCreatedTask(
          reply.memory.content,
          reply.taskActions,
        )
      );

    if (
      reply.memory &&
      shouldSaveMemory
    ) {
      try {
        await savePetMemory(
          reply.memory,
        );
      } catch (cause) {
        console.error(
          "Failed to save pet memory:",
          cause instanceof Error
            ? cause.message
            : cause,
        );
      }
    }

    /*
     * One message may contain multiple task changes.
     *
     * Example:
     * "不是買洗衣精，是買洗髮精"
     *
     * -> cancel old task
     * -> create new task
     */
    for (const taskAction of reply.taskActions) {
      try {
        await applyPetTaskAction(taskAction);
      } catch (cause) {
        console.error(
          "Failed to apply pet task action:",
          cause instanceof Error ? cause.message : cause,
        );
      }
    }

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
