import "server-only";

import { z } from "zod";

import { generateStructured } from "@/lib/ai/generate-structured";

import { PET_PERSONA } from "@/features/pet/ai/pet-persona";
import { petPoseSchema } from "@/features/pet/ai/pet-reply";

import type { PetDailyReportContext } from "@/features/pet/report/get-daily-report-context";

const dailyReportSchema = z.object({
  content: z.string().min(1).max(1200),
  pose: petPoseSchema,
});

export type GeneratedPetDailyReport = z.infer<typeof dailyReportSchema>;

function addDaysToDateKey(
  dateKey: string,
  days: number,
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      dateKey,
    );

  if (!match) {
    throw new Error(
      "Invalid Daily Report date key.",
    );
  }

  const date = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]) + days,
    ),
  );

  return date
    .toISOString()
    .slice(0, 10);
}

export async function generatePetDailyReport(
  context: PetDailyReportContext,
): Promise<GeneratedPetDailyReport> {
  const tomorrowDate =
    addDaysToDateKey(
      context.currentDate,
      1,
    );

  const dayAfterTomorrowDate =
    addDaysToDateKey(
      context.currentDate,
      2,
    );

  /*
   * Only expose information that is useful for
   * writing the report.
   *
   * In particular:
   *
   * - Do NOT expose Pet Task createdAt.
   *   It describes when the record was created,
   *   not when the task happens.
   *
   * - Do NOT expose raw UTC dueAt timestamps.
   *   localDate / localTime are already the
   *   authoritative Asia/Taipei representation.
   *
   * This prevents the model from mixing:
   *
   * "created this morning"
   *
   * with:
   *
   * "appointment tomorrow"
   */
  const reportData = {
    dates: context.dates.map((date) => ({
      title: date.title,
      description: date.description,
      kind: date.kind,

      days: date.days.map((day) => ({
        date: day.date,
        dayNumber: day.dayNumber,

        title: day.title,
        note: day.note,

        items: day.items.map((item) => ({
          type: item.type,
          title: item.title,
          description: item.description,

          locationName:
            item.locationName,

          address: item.address,

          startTime: item.startTime,
          durationMinutes:
            item.durationMinutes,
        })),
      })),
    })),

    study: {
      overdue: context.study.overdue.map(
        (item) => ({
          title: item.title,
          courseName: item.courseName,

          localDate: item.localDate,
          localTime: item.localTime,

          late: item.late,
          missing: item.missing,

          deadlinePassed:
            item.deadlinePassed,
        }),
      ),

      dueToday:
        context.study.dueToday.map(
          (item) => ({
            title: item.title,
            courseName:
              item.courseName,

            localDate:
              item.localDate,
            localTime:
              item.localTime,

            late: item.late,
            missing: item.missing,

            deadlinePassed:
              item.deadlinePassed,
          }),
        ),

      upcoming:
        context.study.upcoming.map(
          (item) => ({
            title: item.title,
            courseName:
              item.courseName,

            localDate:
              item.localDate,
            localTime:
              item.localTime,

            late: item.late,
            missing: item.missing,

            deadlinePassed:
              item.deadlinePassed,
          }),
        ),
    },

    petTasks: {
      overdue:
        context.petTasks.overdue.map(
          (item) => ({
            title: item.title,
            note: item.note,

            localDate:
              item.localDate,
            localTime:
              item.localTime,

            deadlinePassed:
              item.deadlinePassed,
          }),
        ),

      dueToday:
        context.petTasks.dueToday.map(
          (item) => ({
            title: item.title,
            note: item.note,

            localDate:
              item.localDate,
            localTime:
              item.localTime,

            deadlinePassed:
              item.deadlinePassed,
          }),
        ),

      upcoming:
        context.petTasks.upcoming.map(
          (item) => ({
            title: item.title,
            note: item.note,

            localDate:
              item.localDate,
            localTime:
              item.localTime,

            deadlinePassed:
              item.deadlinePassed,
          }),
        ),

      noDueDate:
        context.petTasks.noDueDate.map(
          (item) => ({
            title: item.title,
            note: item.note,

            localDate: null,
            localTime: null,

            deadlinePassed: false,
          }),
        ),
    },
  };

  const prompt = `
你現在要替主人產生「每日報告」。

這不是聊天回覆。
這是一份每天固定時間主動提供給主人的生活整理。

目前真實時間：

- 今天日期：${context.currentDate}
- 現在時間：${context.currentTime}
- 明天日期：${tomorrowDate}
- 後天日期：${dayAfterTomorrowDate}
- 時區：${context.timeZone}

資料涵蓋到：
${context.throughDate}

目前主人：
${context.user.displayName}

你的名字：
${context.pet.name}

以下是真正可以使用的資料：

<daily_report_context>
${JSON.stringify(
  reportData,
  null,
  2,
)}
</daily_report_context>


================================
時間規則
================================

時間判斷是這份報告最重要的規則之一。

所有：

- 今天
- 今早
- 今天早上
- 今天下午
- 今天晚上
- 明天
- 明早
- 明天下午
- 明天晚上
- 後天
- 幾天後

都必須根據事情本身的日期決定。

目前：

今天 = ${context.currentDate}
明天 = ${tomorrowDate}
後天 = ${dayAfterTomorrowDate}


--------------------------------
一件事情只能有一個日期歸屬
--------------------------------

如果某件事情的日期是 ${tomorrowDate}：

可以說：

「明天要回診」
「明天早上要回診」

但不能說：

「今天早上有明天要回診這件事」
「今天有一件明天的回診」
「今天早上提醒你明天回診」

除非你是在描述「今天真的需要做的一個準備動作」。


例如：

可以：

「明天早上要回診，今晚可以先確認時間和交通。」

因為：

- 回診本身 = 明天
- 確認時間 = 今天可以做的準備建議

但不能把「今天」直接修飾明天才發生的回診。


--------------------------------
今天的時間詞
--------------------------------

只有事情本身的日期 =
${context.currentDate}

才可以使用：

- 今天
- 今早
- 今天早上
- 今天下午
- 今天晚上


--------------------------------
明天的時間詞
--------------------------------

只有事情本身的日期 =
${tomorrowDate}

才可以使用：

- 明天
- 明早
- 明天早上
- 明天下午
- 明天晚上


--------------------------------
後天
--------------------------------

只有事情本身的日期 =
${dayAfterTomorrowDate}

才可以稱為：

「後天」


--------------------------------
更後面的日期
--------------------------------

如果事情不是今天、明天或後天：

優先直接說真正日期。

例如：

「10/4 要回診」

不要為了口語自然，
自行把它改成：

「明天」
「後天」


================================
資料欄位規則
================================

Dates：

days.date
就是活動真正發生的日期。

items.startTime
就是當天行程的時間。


Study：

localDate
就是作業在 ${context.timeZone}
的真正截止日期。

localTime
就是真正截止時間。


Pet Tasks：

localDate / localTime
就是待辦真正的日期與時間。

如果 localDate = null，
代表這件待辦沒有確定日期。

不能自行替它安排：

- 今天
- 明天
- 後天


--------------------------------
非常重要
--------------------------------

你看不到 Pet Task 的 createdAt。

這是刻意的。

不要描述：

「主人今天早上記了這件事」
「今天新增了這個待辦」
「今天有明天的事情」

你只需要關心：

「事情什麼時候真正要發生。」


================================
分類規則
================================

study.overdue：
截止日期已經早於今天，
而且仍然尚未提交。

study.dueToday：
今天截止。

study.upcoming：
今天之後、近期即將截止。

注意：

upcoming 不等於明天。

它可能是：

- 明天
- 後天
- 三天後
- 10/4
- 其他近期日期

必須查看 localDate。


petTasks.overdue：
期限已經過去的待辦。

petTasks.dueToday：
今天到期的待辦。

petTasks.upcoming：
近期的未來待辦。

同樣：

upcoming 不等於明天。


================================
報告輸出格式
================================

報告固定分成兩個部分。


第一部分：

「今日／近期事項」

使用列點。

每一件事一個 bullet。

格式類似：

今日／近期事項

- 【今天 14:00】植物病理學作業截止
- 【明天 09:30】回診
- 【10/4】和朋友去新竹
- 【無期限】整理實驗照片


日期標籤必須與事情真正日期一致。

對 Pet Task 而言：

localDate 是日期事實的唯一依據。

如果 task title 本身殘留：
「今天、明天、後天、下週、10/4」
等時間文字，而且與 localDate 重複或衝突，
不要照抄那個時間詞。

要把 title 改寫成只剩事情本身。

例如：

localDate = 今天
title = "明天早上回診"

不可輸出：

【今天】明天早上回診

應輸出：

【今天】早上回診

舊 title 中的相對日期只是歷史文字，
不能凌駕 localDate。

如果沒有時間，
不要硬加時間。

尤其 localTime = null 時，
絕對不要自行顯示 23:59。

23:59:59 可能只是系統內部用來表示
「這一天有期限、但主人沒有指定精確鐘點」的 anchor。

如果沒有日期，
使用：

【無期限】


如果今天完全沒有事情，
但未來有事情：

仍然列出未來真正日期。

不要為了讓報告看起來像「今日報告」
而把未來事情講成今天。


第二部分：

「萌蛋整理」

列點結束後，
再用 1 到 3 句做整體整理。

這裡不要只是重複上面的事項。

要思考：

- 哪一件最急
- 哪些事情彼此靠得很近
- 今天最好先做什麼
- 明天要出門的話，今天可以做什麼準備
- 是否有需要提早開始的作業
- 是否有行程銜接需要注意


例如：

今日／近期事項

- 【明天 09:30】回診
- 【10/4 23:59】作業截止

萌蛋整理

明天有回診，今晚可以先確認時間和交通；
10/4 的作業還有幾天，如果份量不少，
今天先開個頭會比較輕鬆。


================================
準備建議規則
================================

可以提出合理的一般性建議。

例如：

「可以先確認交通」
「可以提前看看行程時間」
「今天可以先做一部分」
「今晚可以先整理明天要用的東西」

但如果資料裡沒有明確寫出某個物品，

不要把推測講成事實。

例如資料只有「回診」：

可以：

「今晚可以先確認回診時間和需要準備的東西。」

不要直接斷言：

「記得帶健保卡、藥袋、檢查報告。」

除非資料真的有提到。


================================
重要性排序
================================

通常依照：

1. 已經逾期且尚未完成
2. 今天的事情
3. 明天的事情
4. 後天的事情
5. 接下來幾天的重要事情
6. 沒有期限的待辦

如果事情很多，
只挑最值得主人現在注意的內容。

如果事情很少，
可以全部列出。


================================
沒有事情時
================================

如果 Dates、Study、Pet Tasks
完全沒有需要提醒的內容：

輸出：

今日／近期事項

- 目前沒有特別急的事情。

萌蛋整理

再用一句簡短自然的話收尾。

不能捏造活動或待辦。


================================
說話方式
================================

- 使用繁體中文
- 保持萌蛋原本的個性
- 可以有一點吐槽或幽默
- 不要像客服
- 不要像正式行事曆
- 簡潔、容易掃讀
- 列點內容要明確
- 最後整理要有實際幫助
- 不顯示資料庫 ID
- 不提 JSON
- 不提 context
- 不提系統資料
- 不說「根據提供的資料」
- 不自行增加不存在的事情
- 不自行假設主人完成某件事
- 不自行改變任何日期或時間


content：

完整的每日報告文字。

必須包含：

1. 今日／近期事項
2. 萌蛋整理


pose：

選擇一個最符合這份報告語氣的姿勢。
`.trim();

  return generateStructured({
    systemInstruction: PET_PERSONA,
    prompt,
    schema: dailyReportSchema,
  });
}
