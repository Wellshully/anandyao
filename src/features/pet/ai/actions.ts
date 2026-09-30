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

import { applyPetRecurringScheduleAction } from "@/features/pet/ai/apply-pet-recurring-schedule-action";

import { getPendingTaskQueryScope } from "@/features/pet/ai/context/intent";

import type { PetReply } from "@/features/pet/ai/pet-reply";

const conversationSchema = z
  .array(
    z.object({
      role: z.enum(["user", "pet"]),

      content: z.string().min(1).max(500),

      /*
       * Keep compatibility with older
       * browser conversation state.
       */
      createdAt: z.string().datetime().nullable().optional(),
    }),
  )
  .max(PET_CONVERSATION_MAX_MESSAGES);

function normalizeSemanticText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function looksLikeTaskMutation(message: string) {
  const normalized = message.normalize("NFKC").toLocaleLowerCase();

  return (
    /改成/u.test(normalized) ||
    /改到/u.test(normalized) ||
    /改為/u.test(normalized) ||
    /改一下/u.test(normalized) ||
    /換成/u.test(normalized) ||
    /延到/u.test(normalized) ||
    /延後/u.test(normalized) ||
    /延期/u.test(normalized) ||
    /提前/u.test(normalized) ||
    /取消/u.test(normalized) ||
    /刪掉/u.test(normalized) ||
    /刪除/u.test(normalized) ||
    /移除/u.test(normalized) ||
    /不要了/u.test(normalized) ||
    /不用了/u.test(normalized) ||
    /做完了/u.test(normalized) ||
    /完成了/u.test(normalized) ||
    /沒改到/u.test(normalized) ||
    /沒有改到/u.test(normalized) ||
    /沒更新/u.test(normalized) ||
    /沒有更新/u.test(normalized) ||
    /沒改成功/u.test(normalized) ||
    /沒有改成功/u.test(normalized) ||
    /還是舊/u.test(normalized)
  );
}

/*
 * Detect a dangerous contradiction:
 *
 * model says mutation succeeded,
 * but no executable structured action exists.
 */
function replyClaimsMutationSuccess(reply: string) {
  const normalized = reply.normalize("NFKC").replace(/\s+/gu, "");

  return (
    /(?:幫你|已經|有|替你).{0,8}(?:改|修改|更新)(?:好|了|完成)/u.test(
      normalized,
    ) ||
    /(?:改|修改|更新)(?:好|好了|完成了)/u.test(normalized) ||
    /(?:幫你|已經|有|替你).{0,8}(?:取消|刪除|刪掉|移除)(?:了|完成)/u.test(
      normalized,
    ) ||
    /(?:取消|刪除|刪掉|移除)(?:好了|完成了|了)/u.test(normalized) ||
    /(?:幫你|已經|有|替你).{0,8}(?:完成|標記完成)(?:了|完成)/u.test(normalized)
  );
}

function memoryOverlapsTaskAction(
  memoryContent: string,
  taskActions: PetReply["taskActions"],
) {
  const normalizedMemory = normalizeSemanticText(memoryContent);

  return taskActions.some((action) => {
    /*
     * create/update both contain task data.
     */
    if (!action.task) {
      return false;
    }

    const candidates = [action.task.title, action.task.note]
      .filter((value): value is string => Boolean(value))
      .map(normalizeSemanticText)
      .filter((value) => value.length >= 2);

    return candidates.some(
      (candidate) =>
        normalizedMemory.includes(candidate) ||
        candidate.includes(normalizedMemory),
    );
  });
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

    const normalizedConversation: PetConversationMessage[] =
      parsedConversation.map((item) => ({
        role: item.role,

        content: item.content,

        createdAt: item.createdAt ?? null,
      }));

    const safeConversation = trimPetConversation(normalizedConversation);

    /*
     * Gemini decides:
     *
     * - natural reply
     * - memory candidate
     * - taskActions
     * - recurringScheduleActions
     */
    const reply = await talkToPet(message, safeConversation);

    console.log("[Pet structured reply]", {
      message,

      reply: reply.reply,

      taskActions: reply.taskActions,

      recurringScheduleActions: reply.recurringScheduleActions,

      memory: reply.memory,
    });

    /*
     * --------------------------------
     * Final server-side consistency guard
     * --------------------------------
     *
     * Natural language cannot claim a mutation
     * succeeded unless there is an actual action.
     *
     * We DO allow:
     *
     * "你是指哪一個行程？"
     * taskActions=[]
     *
     * because ambiguity legitimately requires
     * clarification.
     */
    const detectedScope = getPendingTaskQueryScope(message);

    const mutationIntent =
      detectedScope === "mutation" || looksLikeTaskMutation(message);

    const executableActionCount =
      reply.taskActions.length + reply.recurringScheduleActions.length;

    if (
      mutationIntent &&
      executableActionCount === 0 &&
      replyClaimsMutationSuccess(reply.reply)
    ) {
      console.error("[Pet false mutation confirmation blocked]", {
        message,

        reply: reply.reply,

        taskActions: reply.taskActions,

        recurringScheduleActions: reply.recurringScheduleActions,
      });

      throw new Error(
        "Pet claimed a task change succeeded without producing an executable action.",
      );
    }

    /*
     * --------------------------------
     * Structured mutations FIRST
     * --------------------------------
     *
     * These are authoritative.
     *
     * IMPORTANT:
     * Do not individually catch these errors.
     *
     * If DB mutation fails, the entire request
     * must return success:false.
     */
    for (const taskAction of reply.taskActions) {
      await applyPetTaskAction(taskAction);
    }

    for (const recurringAction of reply.recurringScheduleActions) {
      await applyPetRecurringScheduleAction(recurringAction);
    }

    /*
     * --------------------------------
     * Memory AFTER structured mutations
     * --------------------------------
     *
     * Memory is supplementary.
     *
     * A memory failure should not invalidate
     * an already-successful task mutation.
     */
    const shouldSaveMemory =
      Boolean(reply.memory) &&
      !(
        reply.memory?.type === "temporary" &&
        memoryOverlapsTaskAction(reply.memory.content, reply.taskActions)
      );

    if (reply.memory && shouldSaveMemory) {
      try {
        await savePetMemory(reply.memory);
      } catch (cause) {
        console.error(
          "Failed to save pet memory:",
          cause instanceof Error ? cause.message : cause,
        );
      }
    }

    /*
     * success:true now means every requested
     * structured mutation completed without
     * throwing an error.
     */
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
