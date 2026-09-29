import "server-only";

import { AI_CONFIG } from "@/lib/ai/config";

import { generateStructured } from "@/lib/ai/generate-structured";

import { siteConfig } from "@/config/site";

import { buildPetContext } from "@/features/pet/ai/build-pet-context";

import { buildAppContext } from "@/features/pet/ai/context/build-app-context";
import {
  isRecentActivityQuestion,
  shouldLoadPendingTaskContext,
} from "@/features/pet/ai/context/intent";

import {
  trimPetConversation,
  type PetConversationMessage,
} from "@/features/pet/ai/conversation";

import { PET_PERSONA } from "@/features/pet/ai/pet-persona";

import { petReplySchema, type PetReply } from "@/features/pet/ai/pet-reply";

function getCurrentLocalTimeContext() {
  const now = new Date();

  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: siteConfig.timeZone,

    year: "numeric",

    month: "2-digit",

    day: "2-digit",
  }).formatToParts(now);

  const timeParts = new Intl.DateTimeFormat("en-US", {
    timeZone: siteConfig.timeZone,

    hour: "2-digit",

    minute: "2-digit",

    second: "2-digit",

    hour12: false,

    hourCycle: "h23",
  }).formatToParts(now);

  const weekday = new Intl.DateTimeFormat("zh-TW", {
    timeZone: siteConfig.timeZone,

    weekday: "long",
  }).format(now);

  const year = dateParts.find((part) => part.type === "year")?.value;

  const month = dateParts.find((part) => part.type === "month")?.value;

  const day = dateParts.find((part) => part.type === "day")?.value;

  const hour = timeParts.find((part) => part.type === "hour")?.value;

  const minute = timeParts.find((part) => part.type === "minute")?.value;

  const second = timeParts.find((part) => part.type === "second")?.value;

  if (!year || !month || !day || !hour || !minute || !second) {
    throw new Error("Failed to calculate current Pet local time.");
  }

  return {
    date: `${year}-${month}-${day}`,

    time: `${hour}:${minute}:${second}`,

    weekday,

    timeZone: siteConfig.timeZone,
  };
}

function formatConversationTimestamp(createdAt: string | null) {
  if (!createdAt) {
    return "時間未知的舊對話";
  }

  const date = new Date(createdAt);

  if (!Number.isFinite(date.getTime())) {
    return "時間未知的舊對話";
  }

  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: siteConfig.timeZone,

    year: "numeric",

    month: "2-digit",

    day: "2-digit",

    weekday: "short",

    hour: "2-digit",

    minute: "2-digit",

    hour12: false,

    hourCycle: "h23",
  }).format(date);
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

  const recentActivityQuestion =
    isRecentActivityQuestion(normalized);

  const includePendingTaskContext =
    shouldLoadPendingTaskContext(normalized);

  /*
   * Context boundaries:
   *
   * Normal conversation:
   *   semantic memories only.
   *
   * Task conversation:
   *   current user's pending tasks, but no
   *   unrelated long-term memories.
   *
   * "剛剛 / 剛才" activity questions:
   *   no long-term memories, tasks, Places or
   *   broad historical App context may be used
   *   as evidence of recent activity.
   */
  const [petContext, appContext] =
    await Promise.all([
      buildPetContext(
        memoryQuery,
        {
          includeMemories:
            !recentActivityQuestion &&
            !includePendingTaskContext,

          includePendingTasks:
            includePendingTaskContext,
        },
      ),

      recentActivityQuestion
        ? Promise.resolve("")
        : buildAppContext({
            message: normalized,
          }),
    ]);

  const conversationText =
    recentConversation.length > 0
      ? recentConversation
          .map((item) => {
            const speaker = item.role === "user" ? "主人" : "你";

            const timestamp = formatConversationTimestamp(item.createdAt);

            return [`[${timestamp}]`, `${speaker}：${item.content}`].join("\n");
          })
          .join("\n\n")
      : "目前還沒有前面的對話。";

  const currentLocalTime = getCurrentLocalTimeContext();

  const prompt = `
以下是這一輪允許你使用的身份、狀態與相關資料：

${petContext}

${
  appContext
    ? `
以下是網站中與這次問題相關的真實資料：

${appContext}
`
    : ""
}

目前真實時間：
- 日期：${currentLocalTime.date}
- 時間：${currentLocalTime.time}
- 星期：${currentLocalTime.weekday}
- 時區：${currentLocalTime.timeZone}

--------------------------------
時間理解規則
--------------------------------

「現在」只能以上方提供的真實時間為準。

目前這一則主人訊息中的相對日期：

- 「今天」一定是 ${currentLocalTime.date}。
- 「明天」是今天的下一個日曆日。
- 「後天」是今天之後第二個日曆日。
- 「昨天」是今天的前一個日曆日。
- 「這週」、「下週」、「星期幾」等相對日期，都必須以上面的真實日期與 ${currentLocalTime.timeZone} 為基準。
- 不可以把模型訓練資料中的日期、伺服器 UTC 日期或最近對話中的舊日期當成現在時間。

--------------------------------
「剛剛 / 剛才」規則
--------------------------------

「剛剛」、「剛才」、「方才」代表非常近期發生的事情。

回答：
- 「我剛剛在幹嘛？」
- 「我剛才做了什麼？」
- 「我剛剛去哪？」
- 「我剛剛在哪？」

這類問題時，必須使用非常嚴格的證據標準。

可以作為證據的只有：

1. 最近對話中有明確 createdAt，而且主人明確說自己當時正在做或剛完成某件事。
2. 有明確 timestamp 的實際事件，而且時間真的接近目前時間。

以下全部都不能單獨證明「剛剛在做什麼」：

- pending task
- task dueAt
- 長期記憶
- temporary memory
- 昨天或更早的 Date
- Places 中的 visited / revisit
- 想去的地方
- 未來行程
- 過去曾經做過的事情
- 單純因為某個資訊最近被更新

非常重要：

「昨天去新竹」
只能代表昨天的事情。

即使「去新竹」這筆資料現在仍然存在，
也絕對不能回答成：
「你剛剛去新竹。」

pending task 也只代表還沒完成，
不能回答成：
「你剛剛在做這個。」

如果沒有可靠的近期證據，
應該直接自然回答不知道，
例如：
「這個我不知道耶，你剛剛沒有跟我說。」

不要為了讓回答看起來完整而猜測。

非常重要：

歷史對話中的「今天」、「明天」、「昨天」、「後天」、「下週」等相對時間，
不是以現在的日期重新解讀。

必須以「那一則歷史訊息自己的時間」作為基準。

例如：

如果歷史訊息是：

[2026/09/27 22:00]
主人：明天要去新竹

那句「明天」代表的是 2026-09-28。

即使目前真正日期已經是 2026-09-28，
也絕對不能把那句歷史訊息重新理解成
「2026-09-29 要去新竹」。

如果歷史訊息顯示：

[時間未知的舊對話]

則其中的「今天」、「明天」、「昨天」、「後天」、「下週」等相對日期
不能使用目前日期重新解析。

這些時間未知的舊訊息只能作為對話背景，
不能單獨作為判定現在實際日期安排的依據。

--------------------------------
時間資料可信度
--------------------------------

如果不同資料中對時間的描述可能產生衝突，
請依照以下優先順序理解：

第一優先：
網站提供的結構化真實資料，例如：

- Dates 的 startDate / endDate / days.date / fixedStartTime
- Study 的 dueAt
- Pet Tasks 的 dueAt

第二優先：
有 createdAt 時間的歷史對話。

第三優先：
沒有 createdAt 的舊對話文字。

也就是：

如果歷史聊天曾經說：

「明天要去新竹」

但 Pet Task 現在明確顯示：

去新竹
dueAt = 2026-09-28

就要相信 2026-09-28 這個實際日期。

不要因為現在重新看到「明天」兩個字，
就把它變成目前日期的下一天。

--------------------------------
日期歸屬規則
--------------------------------

每一件事情都必須保留它真正的日期。

不可以因為主人現在正在問「今天」或「明天」，
就把其他日期的事情錯誤描述成今天或明天。

例如：

目前日期 = 2026-09-28

主人問：
「明天要幹嘛？」

如果有：

2026-10-04 練團

可以回答：

「明天目前沒有特別安排，不過 10/4 要練團。」

不可以回答：

「明天要練團。」

除非明天真的就是 10/4。

同理適用於：

- 今天
- 明天
- 後天
- 昨天
- 某個星期幾
- 某個明確日期
- 這週
- 下週

如果主人指定的日期本身沒有事情：

可以直接說該日期目前沒有看到特別安排。

之後可以視情況補充其他近期事項，
但必須清楚說出那些事情真正的日期。

沒有 dueAt 的待辦：

不能自行歸類成今天、明天或任何特定日期。

如果主人說「今天」、「明天」等相對時間，
在回答以及建立 task 的 dueAt 時，
都要先按照上述規則解析。

如果沒有明確時間，只知道日期，
task dueAt 可以使用該日 23:59:59。

不要在正常回答中刻意報出完整系統時間，
除非主人詢問時間或日期。

--------------------------------
最近對話
--------------------------------

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
- 「今天」、「明天」、「後天」、「下週」等相對日期，必須以上方提供的目前真實日期為基準計算。
- 時區使用 Asia/Taipei。
- 只有日期沒有時間時，可以使用該日 23:59:59。
- 完全沒有期限就填 null。
- 不可以自行猜期限。
- 不可以使用模型自己假設的現在日期。

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
