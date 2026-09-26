import "server-only";

import { AI_CONFIG } from "@/lib/ai/config";
import { generateStructured } from "@/lib/ai/generate-structured";

import { buildPetContext } from "@/features/pet/ai/build-pet-context";
import { buildAppContext } from "@/features/pet/ai/context/build-app-context";
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

  const recentConversation = trimPetConversation(conversation);

  /*
   * Use only the most recent part of the conversation
   * when deciding which long-term memories are relevant.
   *
   * This selection happens locally and does not require
   * another LLM call.
   */
  const memoryQuery = [
    ...recentConversation.slice(-4).map((item) => item.content),
    normalized,
  ].join("\n");
  const [petContext, appContext] = await Promise.all([
    buildPetContext(memoryQuery),
    buildAppContext({ message: normalized }),
  ]);
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
以下是你目前知道的身份、狀態與長期記憶：

${petContext}

${
  appContext
    ? `
以下是網站中與這次問題相關的真實資料：

${appContext}
`
    : ""
}

以下是你和這位主人最近的對話：

${conversationText}
現在主人對你說：

${normalized}
請根據你的身份、個性、目前狀態，以及最近的對話回答。

如果主人提到前面聊過的事情，可以自然地記得並接續話題。

除了回答主人之外，判斷主人這一次提供的資訊是否值得形成長期記憶。

記憶規則：

如果沒有值得保存的資訊：
memory = null

importance 1：
短期內可能有用，但未必長期成立的資訊。
例如：
- 最近正在準備考試
- 最近工作很多
- 最近想去某個地方
- 近期正在做某件事情

這類記憶之後可能會過期。

importance 2：
相對穩定，而且未來再次互動時有價值的個人資訊。
例如：
- 飲食偏好
- 興趣
- 習慣
- 長期喜好或討厭的東西
- 相對穩定的個人資訊

importance 3：
對主人身份、兩位主人的關係、共同歷史具有明顯長期意義的核心資訊。
例如：
- 重要紀念日
- 第一次約會
- 對兩人很重要的共同事件
- 具有特殊意義的共同回憶

importance 3 必須非常保守。
不確定 importance 等級時，一律選較低等級。

以下內容通常不要形成記憶：
- 一般閒聊
- 問句本身
- 笑聲
- 打招呼
- 一次性的情緒
- 沒有未來價值的資訊
- 你自己產生的推測
- 你自己說過的內容
- 無法從主人訊息合理確認的資訊
- 僅僅因為網站資料中存在的資訊

memory.content 必須：
- 使用簡短、獨立、未來仍看得懂的陳述句
- 不保存整段聊天原文
- 不加入主人沒有說過的推測
- 最多 200 字

memory.subject：
- 資訊主要描述目前跟你說話的人：current_user
- 資訊主要描述另一位主人：partner
- 資訊描述兩位主人共同的事情或共同回憶：shared

memory.type：
- preference：喜好、討厭、偏好
- person_fact：個人事實
- shared_memory：兩位主人共同經歷或共同歷史
- temporary：短期資訊

不要因為需要產生 memory 而改變你原本的說話方式。
不要主動告訴主人 importance 數字或記憶分類。

不要假裝記得「最近的對話」或提供給你的資料以外的事情。
不要重複列出數值。
不要解釋你的推理。
`.trim();

  return generateStructured({
    systemInstruction: PET_PERSONA,
    prompt,
    schema: petReplySchema,
  });
}
