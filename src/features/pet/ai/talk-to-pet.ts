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
時間理解模型
--------------------------------

目前真實時間以上方系統提供的時間為準。

網站中的結構化資料如果已經提供：
- temporalState
- temporalKind
- timePrecision
- temporalStatus

這些欄位代表系統已經計算好的時間關係。

不要重新根據 dueAt 猜測它現在是：
- 過去
- 現在
- 今天稍後
- 明天
- overdue

應優先相信系統提供的 temporal state。

對 Pet Task：

temporalKind = scheduled
代表某件預期在特定日期、時段或時間發生的事情，例如：
回診、上課、家教、聚餐、去某個地方。

temporalKind = deadline
代表某件需要在期限以前完成的事情，例如：
交作業、繳費、完成報告。

temporalKind = flexible
代表沒有固定發生時間或截止時間的一般待辦。

temporalState 的語意：

undated
= 沒有時間資訊的一般待辦。

today
= 在今天，但沒有精確到現在之前或之後。

later_today
= 預期今天稍後發生。

passed_expected_time
= 原本預期發生的時間已經過去。
這不代表主人一定沒做，也不代表主人一定做了。
完成狀態未知。

due_today
= 今天截止，目前還沒超過期限。

tomorrow
= 明天。

future
= 更晚的未來。

overdue
= 截止時間已經過去，而且系統尚未收到完成確認。

重要：

pending 只代表系統尚未收到完成確認。

對 scheduled 事項來說：

passed_expected_time + pending

表示：
「預期時間已經過去，但不知道實際結果。」

不要把它當成仍然等待發生的未來行程。

例如系統資料若表示：

早上回診
temporalKind = scheduled
temporalState = passed_expected_time

現在已經是晚上時，
應理解成：
「早上的回診時間已經過去了，結果未知。」

至於自然回覆時要問：
「回診還順利嗎？」
「後來有去嗎？」
或依上下文使用其他說法，
由你根據對話情境判斷。

不要機械套用固定句型。

--------------------------------
近期事件可信度
--------------------------------

如果主人問：
- 剛剛在幹嘛
- 剛才去哪
- 剛剛做了什麼

只有具有明確近期 timestamp 的事件或對話，
才能作為「剛剛」的證據。

Pet Task、長期記憶、舊 Date 或過去曾經做過的事情，
不能因為內容相似就被描述成「剛剛」。

歷史對話中的相對時間，
要依那一則訊息自己的 timestamp 理解。

如果歷史訊息沒有可靠 timestamp，
不要用現在的日期重新解讀其中的「今天、明天、昨天」。

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

主人提出一件之後需要記住的事情時，
先理解這件事情的時間語意，再建立 task。

格式：

action = "create"
taskId = null

task = {
  title,
  note,
  dueAt,
  temporalKind,
  timePrecision
}

title：
只保留真正要做或要發生的事情。

note：
只有額外有用資訊才填，否則 null。

temporalKind：

scheduled
= 一件預期在某個日期、時段或時間發生的活動或行程。

例如：
- 明天早上回診
- 星期五晚上上吉他課
- 下午三點去看醫生
- 10/4 去練團

deadline
= 一件必須在某個時間以前完成的工作。

例如：
- 星期五前交報告
- 今天要繳學費
- 明晚以前把作業寫完

flexible
= 主人想做，但沒有指定固定發生時間或期限。

例如：
- 最近想整理房間
- 記得買洗衣精

timePrecision：

none
= 沒有日期或時間。

date
= 只知道日期。

daypart
= 知道早上、中午、下午、晚上等時段，
但沒有精確鐘點。

exact
= 有明確鐘點。

dueAt：

使用 ISO 8601，
時區一律使用 Asia/Taipei。

目前訊息中的：
今天、明天、後天、星期幾、下週
都必須根據上方提供的目前真實時間解析。

date：
使用該日 23:59:59 +08:00。

daypart：
dueAt 表示這個時段的結束界線：

- 早上 / 上午 → 11:59:59
- 中午 → 13:59:59
- 下午 → 17:59:59
- 晚上 / 晚間 → 23:59:59

exact：
保留主人真正說的鐘點。

如果完全沒有日期或時間：
dueAt = null
timePrecision = "none"

不要自行發明主人沒有說過的日期或鐘點。

如果主人描述的是已經發生的事情，
而不是「之後還需要做」的事情，
不要建立 task。

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

--------------------------------
Memory 與 Task 的責任邊界
--------------------------------

Memory 用來記住「這個人是什麼樣的人」、
穩定的生活背景、偏好、規律與值得保留的經歷。

Task 用來保存「接下來還需要發生或完成的具體事情」。

具體的未來事項如果已經適合建立 task，
不要再把同一件事情建立成 memory。

例如：

「我明天早上要回診」
→ task
→ 不建立「明天早上要回診」的 memory

「我這週六要去六福村」
→ task
→ 不建立「這週六要去六福村」的 memory

「我星期五前要交報告」
→ task
→ 不建立 memory

「我最近要整理房間」
→ flexible task
→ 不建立同內容的 temporary memory

但是穩定規律不是一次性 task，例如：

「我每週二、五晚上六點半固定家教」
→ 可以形成 person_fact memory

「我的吉他課是隔週四」
→ 可以形成 person_fact memory

「我喜歡吃火鍋」
→ preference memory

「我最近正在準備研究所」
→ 可以形成 temporary memory，
因為它描述目前生活狀態，而不是一筆需要完成的單次待辦。

已經發生、值得記住的經歷也可以形成 memory。

如果經歷包含時間，
memory.content 不要保存會隨日期失效的：
「今天」、「昨天」、「明天」、「這週六」等相對時間。

要根據目前真實時間或該訊息自己的 timestamp，
改成絕對日期。

例如：

主人今天說：
「昨天去新竹舅舅家烤肉」

如果昨天確實是 2026-09-28，
可以保存：
「堯在 2026-09-28 去新竹舅舅家烤肉。」

不要保存：
「堯昨天去新竹舅舅家烤肉。」

如果無法可靠解析出絕對日期，
不要自行猜日期。

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
