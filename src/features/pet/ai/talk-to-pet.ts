import "server-only";

import { AI_CONFIG } from "@/lib/ai/config";
import { generateStructured } from "@/lib/ai/generate-structured";

import { siteConfig } from "@/config/site";

import { buildPetContext } from "@/features/pet/ai/build-pet-context";
import { buildAppContext } from "@/features/pet/ai/context/build-app-context";

import {
  trimPetConversation,
  type PetConversationMessage,
} from "@/features/pet/ai/conversation";

import { PET_PERSONA } from "@/features/pet/ai/pet-persona";

import { petReplySchema, type PetReply } from "@/features/pet/ai/pet-reply";

function getCurrentLocalTimeContext() {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: siteConfig.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

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

    /*
     * App context routing intentionally uses only
     * the CURRENT message so an old topic does not
     * accidentally load unrelated App data.
     */
    buildAppContext({
      message: normalized,
    }),
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

  const currentLocalTime = getCurrentLocalTimeContext();

  const prompt = `
以下是你目前知道的身份、狀態、長期記憶與主人自己的待辦：

${petContext}

${
  appContext
    ? `
以下是網站中與這次問題相關的真實資料：

${appContext}
`
    : ""
}

目前時間：
${currentLocalTime}
時區：
${siteConfig.timeZone}

以下是你和這位主人最近的對話：

${conversationText}

現在主人對你說：

${normalized}

請根據你的身份、個性、目前狀態，以及最近的對話回答。

如果主人提到前面聊過的事情，可以自然地記得並接續話題。

除了回答之外，你還需要分別判斷：

1. 這次訊息是否值得形成長期記憶。
2. 這次訊息是否包含一件目前正在跟你說話的主人「之後需要做」的待辦。

--------------------------------
待辦 task 規則
--------------------------------

task 只用來儲存目前正在跟你說話的主人，未來需要完成的具體事情。

適合建立 task 的例子：

- 「我明天要買生日禮物」
- 「我星期三前要把植物病理報告寫完」
- 「我最近要整理房間」
- 「記得我要去繳學費」
- 「這週我要把簡報做完」

這些情況 task 不可以是 null。

task.title：
- 簡短描述真正要完成的事情。
- 不要保存整句聊天。
- 例如「完成植物病理報告」、「買生日禮物」。

task.note：
- 如果主人提供了有用但不適合放在 title 的補充資訊，可以填入。
- 沒有就填 null。
- 不要自行增加主人沒有說的資訊。

task.dueAt：
- 有明確日期或可以合理解析的相對日期時，轉成 ISO 8601 timestamp。
- 使用 Asia/Taipei 時區。
- 例如：2026-09-30T23:59:59+08:00。
- 如果只指定日期而沒有時間，可以使用當天 23:59:59。
- 如果完全沒有說期限，填 null。
- 不可以自己猜一個期限。

根據上方提供的「目前時間」解析：
- 今天
- 明天
- 後天
- 星期一到星期日
- 這週
- 下週
等相對日期。

以下情況 task 必須為 null：

- 一般問題，例如「我今天有什麼作業？」
- 單純詢問 App 中已經存在的 Study / Dates 資料
- 主人只是在閒聊
- 主人描述已經完成的事情
- 「我最近很累」這類狀態，但沒有具體要完成的事情
- 描述另一位主人的待辦
- 你自己推測主人應該要做的事情
- 僅僅因為 app_context 中存在某件事情

非常重要：

Study、Dates、Today 等 App 原本已經存在的資料，
不要因為這次被讀進 app_context 就複製成 pet_tasks。

只有主人自己在聊天訊息中提出新的待辦，
才建立 task。

如果這次建立了 task，
通常不要再把同一件事情重複存成 temporary memory。
除非主人同時提供了另一個獨立且具有長期價值的資訊。

--------------------------------
長期記憶 memory 規則
--------------------------------

如果沒有值得保存的資訊：
memory = null

importance 1：
短期內可能有用，但未必長期成立的資訊。
例如：
- 最近正在準備考試
- 最近工作很多
- 最近想去某個地方

這類記憶之後可能會過期。

注意：
具體「要做的事情」現在應優先存成 task，
不要再只存成 temporary memory。

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

不要因為需要產生 memory 或 task 而改變你原本的說話方式。

不要主動告訴主人：
- memory importance
- memory 分類
- task schema
- dueAt 格式

不要假裝記得最近對話或提供資料以外的事情。
不要重複列出數值。
不要解釋你的推理。
`.trim();

  return generateStructured({
    systemInstruction: PET_PERSONA,
    prompt,
    schema: petReplySchema,
  });
}
