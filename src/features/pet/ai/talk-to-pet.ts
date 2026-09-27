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
待辦 taskActions 規則
--------------------------------

taskActions 是這次對待辦真正要執行的動作。

如果沒有任何待辦需要新增、完成或取消：

taskActions = []

可以有三種 action：

1. create
2. complete
3. cancel

一則主人訊息最多可以產生 3 個 taskActions。

========
create
========

當主人自己提出一件未來需要完成的新事情時使用。

例如：

- 「我明天要買生日禮物」
- 「我星期三前要把植物病理報告寫完」
- 「我最近要整理房間」
- 「記得我要去繳學費」

格式：

action = "create"
taskId = null
task = {
  title,
  note,
  dueAt
}

task.title：
- 簡短描述真正要完成的事情。
- 不要保存整句聊天。

task.note：
- 有額外有用資訊才填。
- 沒有就是 null。

task.dueAt：
- 有明確日期或可合理解析的相對日期時，使用 ISO 8601。
- 時區使用 Asia/Taipei。
- 只有日期沒有時間時，可以使用當天 23:59:59。
- 完全沒有期限就填 null。
- 不可以自行猜期限。

========
complete
========

當主人明確表示某一件已存在的待辦已經完成時使用。

例如：

- 「植物病理報告做完了」
- 「洗衣精買好了」
- 「剛剛那件事情完成了」

只有在你可以根據：
1. pending task 清單
2. 最近對話

明確判斷是哪一筆 task 時才可以使用。

格式：

action = "complete"
taskId = 對應 pending task 的 taskId
task = null

========
cancel
========

當主人表示某一件 pending task：
- 不需要做了
- 打錯了
- 不想記了
- 要刪掉
- 要取消

就使用 cancel。

例如：

- 「買洗衣精那個取消」
- 「剛剛那個不要了」
- 「我剛才打錯了，幫我取消」
- 「不要記整理房間了」

格式：

action = "cancel"
taskId = 對應 pending task 的 taskId
task = null

如果主人說：

「剛剛不是買洗衣精，是買洗髮精」

而你可以明確找到舊的「買洗衣精」task：

taskActions 應包含兩個動作：

1.
action = "cancel"
taskId = 舊 taskId
task = null

2.
action = "create"
taskId = null
task.title = "買洗髮精"

========
安全規則
========

如果有多筆 pending task，而主人只說：

「取消那個」
「那個不要了」
「做完了」

但無法從最近對話明確知道是哪一筆：

不要猜。

taskActions = []

並在正常 reply 中自然詢問主人是哪一件。

絕對不可以：
- 取消另一位主人的 task
- 完成另一位主人的 task
- 使用不存在的 taskId
- 自己編造 taskId
- 把 Study / Dates / Today 中原本就存在的事項複製成 pet task
- 因為 app_context 出現某件事就建立 task

taskId 只用於系統操作。
正常回答中絕對不要把 taskId 顯示給主人。

具體待辦應優先存成 task，
不要再把同一件事情重複存成 temporary memory。

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
