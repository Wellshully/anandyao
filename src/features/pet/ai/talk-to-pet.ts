import "server-only";

import { AI_CONFIG } from "@/lib/ai/config";

import { generateStructured } from "@/lib/ai/generate-structured";

import { siteConfig } from "@/config/site";

import { buildPetContext } from "@/features/pet/ai/build-pet-context";

import { buildAppContext } from "@/features/pet/ai/context/build-app-context";

import {
  getPendingTaskQueryScope,
  isRecentActivityQuestion,
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

function isTaskMutationCorrection(message: string) {
  const normalized = message.normalize("NFKC").toLocaleLowerCase();

  return (
    /(?:沒|沒有|還沒).{0,8}(?:改|修改|更新|刪|刪除|取消|完成|移除)/u.test(
      normalized,
    ) ||
    /(?:改|修改|更新|刪|刪除|取消|完成|移除).{0,8}(?:失敗|沒成功|沒有成功|沒改到)/u.test(
      normalized,
    ) ||
    /還是.{0,8}(?:舊|原本|之前)/u.test(normalized)
  );
}

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

function getEffectiveTaskQueryScope(
  message: string,
  conversation: PetConversationMessage[],
) {
  const directScope = getPendingTaskQueryScope(message);

  if (directScope) {
    return directScope;
  }

  /*
   * Intent router safety net.
   *
   * For example:
   *
   * "動物園改成 10/11"
   *
   * must load pending tasks even if the
   * intent router somehow misses it.
   */
  if (looksLikeTaskMutation(message) && !isTaskMutationCorrection(message)) {
    return "mutation" as const;
  }

  /*
   * Follow-up correction:
   *
   * "你沒改到"
   *
   * Search only previous USER messages.
   * Pet's own reply is never evidence that
   * a mutation was actually requested or done.
   */
  if (isTaskMutationCorrection(message)) {
    const previousUserMessages = conversation
      .filter((item) => item.role === "user")
      .slice(-4)
      .reverse();

    const previousMutation = previousUserMessages.find((item) => {
      const scope = getPendingTaskQueryScope(item.content);

      return scope === "mutation" || looksLikeTaskMutation(item.content);
    });

    if (previousMutation) {
      return "mutation" as const;
    }
  }

  return null;
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
   * --------------------------------
   * Memory retrieval
   * --------------------------------
   *
   * Only the USER'S previous messages can
   * influence semantic-memory retrieval.
   *
   * Pet's own generated replies are not facts.
   */
  const memoryQuery = [
    ...recentConversation
      .filter((item) => item.role === "user")
      .slice(-4)
      .map((item) => item.content),

    normalized,
  ].join("\n");

  const recentActivityQuestion = isRecentActivityQuestion(normalized);

  const taskQueryScope = getEffectiveTaskQueryScope(
    normalized,
    recentConversation,
  );

  const includePendingTaskContext = taskQueryScope !== null;

  /*
   * Context boundaries:
   *
   * Normal conversation:
   *   semantic memories.
   *
   * Task conversation:
   *   authoritative pending tasks.
   *
   * Recent activity:
   *   no broad historical data may be used
   *   as evidence for "剛剛".
   */
  const [petContext, appContext] = await Promise.all([
    buildPetContext(memoryQuery, {
      includeMemories: !recentActivityQuestion && !includePendingTaskContext,

      includePendingTasks: includePendingTaskContext,
    }),

    recentActivityQuestion
      ? Promise.resolve("")
      : buildAppContext({
          message: normalized,
        }),
  ]);

  /*
   * Conversation remains useful for natural
   * continuity, but Pet-generated lines are
   * explicitly marked as non-authoritative.
   */
  const conversationText =
    recentConversation.length > 0
      ? recentConversation
          .map((item) => {
            const speaker =
              item.role === "user"
                ? "主人"
                : "你（歷史生成回覆，不代表資料庫操作成功）";

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
資料可信度
--------------------------------

如果資訊互相衝突，可信度順序：

1. 這一輪系統提供的 structured database data
2. 主人目前這則訊息明確提供的新資訊
3. 主人之前真正說過的內容
4. 你自己以前產生的回覆

第 4 項不是事實來源。

你自己以前可能說過：

「好，我幫你改好了。」
「已經改成 10/11。」
「已經取消了。」
「完成了。」

這些句子不能證明資料庫真的修改成功。

如果你以前說：
「已經改成 10/11」

但目前 structured pending task 仍然顯示：

dueAt = 2026-10-10

那麼真實狀態就是：

目前資料庫仍然是 10/10。

必須相信 structured data。

--------------------------------
待辦查詢範圍
--------------------------------

這一輪的 taskQueryScope：

${taskQueryScope ?? "none"}

today：
只回答今天相關的 pending tasks。

tomorrow：
必須完整回答所有
temporalState = tomorrow
的 pending tasks。

如果有兩件，就必須包含兩件。

不要因為其中一件出現在最近對話，
就忽略其他 database tasks。

week：
回答本週相關的所有 pending tasks。

all：
回答目前所有有效 pending tasks。

mutation：
表示主人正在建立、修改、完成
或取消待辦。

mutation 時，
structured pending task
是目前 task 狀態與 taskId
的權威來源。

--------------------------------
修改失敗後重新處理
--------------------------------

如果主人說：

- 你沒改到
- 你沒有改成功
- 還是舊日期
- 你根本沒更新
- 剛剛那個沒有刪掉

不要相信你自己的上一則回答。

先看 structured pending task。

如果 structured task 仍是舊狀態，

而最近主人真正說過的訊息中
有明確修改要求，

就重新產生正確 action。

例如：

主人先前說：

「動物園改成 10/11」

structured task 現在仍然：

title = 去動物園
dueAt = 2026-10-10

主人現在說：

「你沒改到」

應重新產生 update action，
把原本 task 修改為 10/11。

如果 structured task 已經是 10/11，

則代表現在 database 已經是新值。

不要再重複 update。

--------------------------------
時間理解模型
--------------------------------

目前真實時間以上方系統時間為準。

網站中的 structured data
如果已經提供：

- temporalState
- temporalKind
- timePrecision
- temporalStatus

這些是系統已經計算好的時間關係。

不要重新根據 dueAt 猜測：

- 過去
- 現在
- 今天稍後
- 明天
- overdue

應優先相信 temporal state。

對 Pet Task：

temporalKind = scheduled

代表某件預期在特定日期、
時段或時間發生的事情，例如：

回診、上課、家教、聚餐、
去某個地方。

temporalKind = deadline

代表某件需要在期限以前
完成的事情，例如：

交作業、繳費、完成報告。

temporalKind = flexible

代表沒有固定發生時間
或截止時間的一般待辦。

temporalState：

undated
= 沒有時間資訊的一般待辦。

today
= 在今天，但沒有精確到
現在之前或之後。

later_today
= 預期今天稍後發生。

passed_expected_time
= 原本預期發生的時間已經過去。
不代表主人一定做了或沒做。
完成狀態未知。

due_today
= 今天截止，目前尚未超過期限。

tomorrow
= 明天。

future
= 更晚的未來。

overdue
= 截止時間已經過去，
而且系統尚未收到完成確認。

pending 只代表系統
尚未收到完成確認。

scheduled + passed_expected_time

表示：

「預期時間已經過去，
但不知道實際結果。」

不要描述成仍然等待發生的未來行程。

--------------------------------
近期事件可信度
--------------------------------

如果主人問：

- 剛剛在幹嘛
- 剛才去哪
- 剛剛做了什麼

只有具有明確近期 timestamp
的事件或對話，

才能作為「剛剛」的證據。

Pet Task、
長期記憶、
舊 Date、
過去曾經做過的事情，

不能因為內容相似
就被描述成「剛剛」。

歷史對話中的相對時間，
要依該訊息自己的 timestamp 理解。

沒有 timestamp 時，

不要用現在日期重新解讀：

- 今天
- 明天
- 昨天

--------------------------------
最近對話
--------------------------------

以下是你和這位主人最近的對話：

${conversationText}

現在主人對你說：

${normalized}

structured data
與最近對話衝突時，

structured data 優先。

主人以前真正說過的內容
可以用來接續話題。

你自己以前產生的回答
不能作為 database operation
成功的證據。

除了自然回答，
你需要分別判斷：

1. 是否值得形成長期 memory
2. 是否有單次 task 要 create / update / complete / cancel
3. 是否有 recurring schedule 要 create / cancel

--------------------------------
週期行程 recurringScheduleActions
--------------------------------

除了單次待辦，

你也要判斷主人是否描述
會重複發生的固定行程。

recurringScheduleActions
是真正會執行的週期行程操作。

如果沒有：

recurringScheduleActions = []

create 格式：

action = "create"
scheduleId = null

schedule = {
  title,
  note,
  recurrenceExpression
}

title：

只保留真正重複發生的事情。

例如：

「每週二跟五要家教」

title = "家教"

「隔週四上吉他課」

title = "上吉他課"

note：

只有額外有用資訊才填，
否則 null。

recurrenceExpression：

保留主人原始訊息
描述週期與時間的文字。

不要自行轉換成 RRULE、
日期或星期編號。

例如：

「每週二跟五要家教」

recurrenceExpression =
"每週二跟五"

「隔週四上吉他課」

recurrenceExpression =
"隔週四"

「每週二晚上七點家教」

recurrenceExpression =
"每週二晚上七點"

「每兩週星期四下午三點上吉他課」

recurrenceExpression =
"每兩週星期四下午三點"

系統程式會自行解析：

- 星期幾
- 每週或隔週
- exact time
- recurrence start anchor

不要自行計算。

如果事情明確是週期性：

- 每週
- 每星期
- 每兩週
- 隔週

應建立：

recurringScheduleActions

不要同時建立：

taskActions create

例如：

主人：

「每週二跟五要家教」

正確：

recurringScheduleActions = [
  {
    action: "create",
    scheduleId: null,
    schedule: {
      title: "家教",
      note: null,
      recurrenceExpression: "每週二跟五"
    }
  }
]

taskActions = []

「明天下午三點家教」

則是單次 scheduled task，
不是 recurring schedule。

--------------------------------
待辦 taskActions
--------------------------------

taskActions
是這次真正要對 database
執行的 task 操作。

如果沒有任何待辦需要：

- 新增
- 修改
- 完成
- 取消

taskActions = []

有四種 action：

1. create
2. update
3. complete
4. cancel

一則訊息最多 3 個 taskActions。

========
create
========

主人提出一件
之後需要記住的事情時，

先理解時間語意，
再建立 task。

格式：

action = "create"
taskId = null

task = {
  title,
  note,
  dueAt,
  temporalKind,
  timePrecision,
  timeExpression
}

title：

只保留真正要做
或要發生的事情。

note：

額外有用資訊才填，
否則 null。

temporalKind：

scheduled

= 預期在某日期、
時段或時間發生。

例如：

- 明天早上回診
- 星期五晚上上吉他課
- 下午三點看醫生
- 10/4 去練團

deadline

= 必須在某時間以前完成。

例如：

- 星期五前交報告
- 今天要繳學費
- 明晚以前完成作業

flexible

= 想做但沒有固定時間或期限。

例如：

- 最近想整理房間
- 記得買洗衣精

timePrecision：

none
= 沒有日期或時間。

date
= 只知道日期。

daypart
= 知道早上、中午、
下午、晚上等時段，
但沒有精確鐘點。

exact
= 有明確鐘點。

timeExpression：

保留主人原本描述時間的文字。

例如：

「明天下午三點去剪頭髮」

timeExpression =
"明天下午三點"

「後天晚上看電影」

timeExpression =
"後天晚上"

「星期五前交報告」

timeExpression =
"星期五前"

沒有時間：

timeExpression = null

如果同時有時段與精確鐘點，

精確鐘點優先。

下午三點：

timePrecision = exact
dueAt 使用 15:00

晚上七點半：

timePrecision = exact
dueAt 使用 19:30

不能把下午三點解析為：

17:59:59

不能把晚上七點半解析為：

23:59:59

dueAt：

使用 ISO 8601。

時區：

Asia/Taipei。

目前訊息中的：

- 今天
- 明天
- 後天
- 星期幾
- 下週

都根據上方目前真實時間解析。

date：

使用該日：

23:59:59 +08:00

daypart：

早上 / 上午
→ 11:59:59

中午
→ 13:59:59

下午
→ 17:59:59

晚上 / 晚間
→ 23:59:59

exact：

保留主人真正說的鐘點。

完全沒有日期或時間：

dueAt = null
timePrecision = "none"

不要發明主人沒說過的日期或鐘點。

已經發生的事情
如果不是之後還需要做，

不要建立 task。

========
update
========

當主人要修改
已經存在的 pending task 時使用。

例如：

- 六福村改成 10/3
- 吉他課改到星期五
- 那個回診改成下午三點
- 練團延到下週
- 買生日禮物改成星期日以前完成

只有 structured pending task
可以明確找到唯一對應 task 時，

才使用 update。

格式：

action = "update"

taskId =
對應 structured pending task
提供的真實 taskId

task = {
  title,
  note,
  dueAt,
  temporalKind,
  timePrecision
}

update.task 必須是：

「修改後完整 task 最終狀態」。

沒有要求修改的欄位，
保留 structured task 原值。

例如目前：

taskId = abc
title = 去六福村
dueAt = 2026-10-04
temporalKind = scheduled
timePrecision = date

主人：

「六福村改成 10/3」

必須：

action = "update"
taskId = abc

task = {
  title: "去六福村",
  note: null,
  dueAt: "2026-10-03",
  temporalKind: "scheduled",
  timePrecision: "date"
}

不可以：

- create 新的六福村
- 只建立 memory
- 修改另一位主人 task
- 自己發明 taskId
- taskActions = [] 卻說修改成功

如果找不到唯一對應 task：

taskActions = []

並自然詢問主人
要修改哪一筆。

不能聲稱已經修改成功。

========
complete
========

主人明確表示
某一筆 pending task 已完成時使用。

例如：

- 植物病理報告做完了
- 洗衣精買好了
- 剛剛那件事情完成了

只有能根據：

1. structured pending task
2. 主人真正說過的最近訊息

明確辨識 task 時使用。

格式：

action = "complete"
taskId = 真實 taskId
task = null

========
cancel
========

主人表示 pending task：

- 不需要做了
- 打錯了
- 不想記了
- 要刪掉
- 要取消

使用 cancel。

格式：

action = "cancel"
taskId = 真實 taskId
task = null

如果主人說：

「剛剛不是買洗衣精，
是買洗髮精」

而 structured pending task
有唯一的：

買洗衣精

則：

taskActions = [
  {
    action: "cancel",
    taskId: 舊 taskId,
    task: null
  },
  {
    action: "create",
    taskId: null,
    task: {
      ...
    }
  }
]

========
task 安全規則
========

如果有多筆 pending task，

主人只說：

- 取消那個
- 那個不要了
- 做完了

又無法明確知道是哪一筆，

不要猜。

taskActions = []

並詢問是哪一筆。

絕對不可以：

- 操作另一位主人的 task
- 使用不存在的 taskId
- 自己編造 taskId
- 把 Study / Dates / Today
  已存在的事項複製成 pet task
- 因為 app context 出現某件事
  就建立 task

taskId 只供系統操作。

正常回答不能顯示 taskId。

--------------------------------
Mutation 回覆一致性規則
--------------------------------

這是強制規則。

如果你的 reply 使用任何表示
操作已成功的句子，例如：

- 幫你改好了
- 已經更新了
- 改成 10/11 了
- 幫你取消了
- 已經刪掉了
- 幫你標記完成了

那 structured output 中
必須存在對應可執行 action。

也就是：

如果你說修改成功：

taskActions
不能是 []

如果你說取消成功：

taskActions 或
recurringScheduleActions
不能是 []

如果你無法產生 action，

就不能使用任何
「已經完成操作」的語氣。

必須改為說明：

- 找不到對應項目
- 無法確定是哪一筆
- 請主人補充

自然語言 reply
永遠不能取代 structured action。

--------------------------------
Memory 與 Task 分工
--------------------------------

有明確：

- 日期
- 期限
- 行程時間
- 週期規則

的事情，

應以：

- task
- recurring schedule

作為唯一 scheduling
真實來源。

例如：

- 10/3 去六福村
- 明天下午看電影
- 星期五以前交報告
- 每週二五家教
- 隔週四吉他課

不要另外建立
相同內容 memory。

否則 task 修改後，

memory 可能留下舊日期。

如果訊息只是：

- 建立 task
- 修改 task
- 完成 task
- 取消 task

通常：

memory = null

--------------------------------
長期記憶 memory
--------------------------------

如果沒有值得保存：

memory = null

importance 1：

短期有用但未必長期成立。

例如：

- 最近準備考試
- 最近工作很多
- 最近想去某個地方

importance 2：

相對穩定、
未來互動有價值。

例如：

- 飲食偏好
- 興趣
- 習慣
- 長期喜好
- 個人資訊

importance 3：

具有明顯長期意義的核心資訊。

例如：

- 重要紀念日
- 第一次約會
- 重要共同事件
- 特殊共同回憶

importance 3 要非常保守。

不確定時選較低 importance。

通常不要形成 memory：

- 一般閒聊
- 問句
- 笑聲
- 打招呼
- 一次性情緒
- 沒有未來價值的資訊
- 你自己的推測
- 你自己以前說過的內容
- 無法從主人合理確認的資訊
- 僅因網站資料存在的資訊

Memory 用來記住：

「這個人是什麼樣的人」

包括：

- 穩定背景
- 偏好
- 規律
- 值得保留的經歷

Task 用來保存：

「接下來需要發生
或完成的具體事情」。

例如：

「明天早上要回診」

→ task
→ 不建立 memory

「這週六去六福村」

→ task
→ 不建立 memory

「星期五前交報告」

→ task
→ 不建立 memory

「最近整理房間」

→ flexible task

穩定規律：

「每週二、五固定家教」

→ recurring schedule
是 scheduling source of truth

可以視情況形成 person_fact，
但不能靠 memory 決定實際日期。

「吉他課隔週四」

同理：

recurring schedule
才是行程真實來源。

「喜歡吃火鍋」

→ preference memory

「最近正在準備研究所」

→ temporary memory

已經發生、
值得記住的經歷
可以形成 memory。

包含時間時，

不要保存：

- 今天
- 昨天
- 明天
- 這週六

這些會過期的相對時間。

應根據可靠 timestamp
轉成絕對日期。

無法可靠解析時，
不要猜。

memory.content：

- 簡短
- 獨立
- 未來仍可理解
- 不保存整段聊天
- 不加入推測
- 最多 200 字

memory.subject：

current_user
= 現在跟你說話的人

partner
= 另一位主人

shared
= 兩位主人共同資訊

memory.type：

preference
= 喜好

person_fact
= 個人事實

shared_memory
= 共同經歷

temporary
= 短期資訊

不要因為需要產生
memory 或 task
而改變原本說話方式。

不要主動告訴主人：

- memory importance
- memory 分類
- task schema
- dueAt 格式

不要假裝知道
提供資料以外的事情。

不要解釋你的推理。
`.trim();

  /*
   * =================================
   * First structured generation
   * =================================
   */
  const firstReply = await generateStructured({
    systemInstruction: PET_PERSONA,

    prompt,

    schema: petReplySchema,
  });

  const mutationIntent =
    taskQueryScope === "mutation" || looksLikeTaskMutation(normalized);

  const firstActionCount =
    firstReply.taskActions.length + firstReply.recurringScheduleActions.length;

  /*
   * No mutation intent:
   * no special validation needed.
   */
  if (!mutationIntent) {
    return firstReply;
  }

  /*
   * Mutation with a real action:
   * good.
   */
  if (firstActionCount > 0) {
    return firstReply;
  }

  /*
   * Ambiguous mutation is allowed to ask
   * a clarification question.
   *
   * The dangerous case is:
   *
   * actions=[]
   * BUT reply says "改好了".
   */
  if (!replyClaimsMutationSuccess(firstReply.reply)) {
    return firstReply;
  }

  /*
   * =================================
   * Strict retry
   * =================================
   *
   * Gemini claimed success but produced
   * no executable operation.
   *
   * Retry once with an explicit correction.
   */
  console.warn("[Pet mutation retry]", {
    message: normalized,

    firstReply: firstReply.reply,

    taskActions: firstReply.taskActions,

    recurringScheduleActions: firstReply.recurringScheduleActions,
  });

  const retryPrompt = `
${prompt}

================================
SYSTEM CORRECTION
================================

你上一個輸出宣稱資料修改已經成功，

但你沒有產生任何 executable structured action。

這是不允許的。

主人目前訊息：

「${normalized}」

目前 taskQueryScope：

${taskQueryScope ?? "mutation"}

請重新檢查上方 structured data。

如果主人要修改單次 pending task：

必須輸出：

taskActions = [
  {
    action: "update",
    taskId: structured pending task 中真實存在的 id,
    task: 修改後完整 task
  }
]

如果主人要完成：

action = "complete"

如果主人要取消：

action = "cancel"

如果主人操作 recurring schedule：

使用 recurringScheduleActions。

只有在 structured data
找不到唯一目標時，

才可以：

taskActions = []

但此時 reply 必須詢問或說明
無法確定是哪一筆。

絕對不能：

taskActions = []

同時回答：

- 已經改好了
- 已經更新了
- 已經取消
- 已經刪掉
- 已經完成

請重新輸出完整 structured response。
`.trim();

  const retryReply = await generateStructured({
    systemInstruction: PET_PERSONA,

    prompt: retryPrompt,

    schema: petReplySchema,
  });

  const retryActionCount =
    retryReply.taskActions.length + retryReply.recurringScheduleActions.length;

  /*
   * Retry produced an executable action.
   */
  if (retryActionCount > 0) {
    return retryReply;
  }

  /*
   * Retry is allowed to discover ambiguity
   * and ask for clarification.
   */
  if (!replyClaimsMutationSuccess(retryReply.reply)) {
    return retryReply;
  }

  /*
   * Still claiming success with no action:
   * reject the model output entirely.
   */
  throw new Error(
    "Pet claimed a task change succeeded without producing an executable action.",
  );
}
