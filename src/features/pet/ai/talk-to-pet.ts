import "server-only";

import { AI_CONFIG } from "@/lib/ai/config";

import { generateStructured } from "@/lib/ai/generate-structured";

import { PET_PERSONA } from "@/features/pet/ai/pet-persona";

import { petReplySchema, type PetReply } from "@/features/pet/ai/pet-reply";

import { buildPetContext } from "@/features/pet/ai/build-pet-context";

export async function talkToPet(message: string): Promise<PetReply> {
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

  const prompt = `
以下是你目前知道的真實資料：

${context}

現在主人對你說：

${normalized}

請根據你的身份、個性與目前狀態回答。

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
