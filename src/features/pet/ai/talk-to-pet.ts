import "server-only";

import { AI_CONFIG } from "@/lib/ai/config";
import { generateStructured } from "@/lib/ai/generate-structured";

import { buildPetContext } from "@/features/pet/ai/build-pet-context";
import {
  trimPetConversation,
  type PetConversationMessage,
} from "@/features/pet/ai/conversation";
import { PET_PERSONA } from "@/features/pet/ai/pet-persona";
import { petReplySchema, type PetReply } from "@/features/pet/ai/pet-reply";

export async function talkToPet(
  message: string,
  conversation: PetConversationMessage[] = [],
): Promise<PetReply> {
  const normalized = message.trim();

  if (!normalized) {
    throw new Error("Message is empty.");
  }

  if (normalized.length > AI_CONFIG.maxUserMessageLength) {
    throw new Error(
      `Message is too long. Maximum ${AI_CONFIG.maxUserMessageLength} characters.`,
    );
  }

  const context = await buildPetContext();

  const recentConversation = trimPetConversation(conversation);

  const conversationText =
    recentConversation.length > 0
      ? recentConversation
          .map((item) => {
            const speaker = item.role === "user" ? "主人" : "你";

            return `${speaker}：${item.content}`;
          })
          .join("\n")
      : "目前還沒有前面的對話。";

  const prompt = `
以下是你目前知道的真實資料：

${context}

以下是你和這位主人最近的對話：

${conversationText}

現在主人對你說：

${normalized}

請根據你的身份、個性、目前狀態，以及最近的對話回答。

如果主人提到前面聊過的事情，可以自然地記得並接續話題。

不要假裝記得「最近的對話」以外沒有提供給你的事情。
不要重複列出數值。
不要解釋你的推理。
只需要自然地回應主人。
`.trim();

  return generateStructured({
    systemInstruction: PET_PERSONA,
    prompt,
    schema: petReplySchema,
  });
}
