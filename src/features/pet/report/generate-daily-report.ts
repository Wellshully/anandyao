import "server-only";

import { z } from "zod";

import { generateStructured } from "@/lib/ai/generate-structured";

import { PET_PERSONA } from "@/features/pet/ai/pet-persona";
import { petPoseSchema } from "@/features/pet/ai/pet-reply";

import type { PetDailyReportContext } from "@/features/pet/report/get-daily-report-context";

const dailyReportSchema = z.object({
  content: z.string().min(1).max(800),

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

  const prompt = `
你現在要替主人產生「每日報告」。

這不是聊天回覆。
這是一份每天固定時間主動提供給主人的簡短生活提醒。

目前真實時間：
- 今天日期：${context.currentDate}
- 現在時間：${context.currentTime}
- 明天日期：${tomorrowDate}
- 後天日期：${dayAfterTomorrowDate}
- 時區：${context.timeZone}

資料涵蓋到：
${context.throughDate}

--------------------------------
時間語意與日期歸屬規則
--------------------------------

這一段非常重要。

所有「今天、明天、後天、之後、接下來幾天」
都必須以上面的目前真實日期為基準。

- 今天 = ${context.currentDate}
- 明天 = ${tomorrowDate}
- 後天 = ${dayAfterTomorrowDate}

絕對不能因為某件事情出現在 upcoming 裡，
就把它描述成「明天」。

upcoming 的意思只是：

「日期晚於今天，且仍在這份報告的近期範圍內。」

每一件事情仍然有自己的真正日期。

例如：

如果：
- 今天 = ${context.currentDate}
- 明天 = ${tomorrowDate}
- 某 Pet Task 的 localDate = 2026-10-04

除非 ${tomorrowDate} 真的是 2026-10-04，
否則絕對不能說：

「明天要做這件事」

而應該說：

「10/4 要做這件事」

或其他清楚保留真正日期的表達方式。

日期資料可信度：

1. Dates：
   days.date 是這個行程真正發生的本地日期。

2. Study：
   localDate / localTime 是已經換算成
   ${context.timeZone} 的真正截止日期與時間。

3. Pet Tasks：
   localDate / localTime 是已經換算成
   ${context.timeZone} 的真正待辦日期與時間。

dueAt 是機器使用的 timestamp。

當 dueAt 與 localDate/localTime 同時存在時，
在自然語言報告中應以 localDate/localTime
判斷「今天、明天、後天、幾月幾日」。

不要自行重新用 UTC 解讀 dueAt。

study.dueToday 與 petTasks.dueToday
已經由系統依 ${context.timeZone} 正確分類成今天。

study.upcoming 與 petTasks.upcoming
可能是明天，也可能是後天、10/4 或其他近期日期。

必須逐筆查看 localDate，
不能把整個 upcoming 類別統稱為「明天」。

沒有 localDate 的 Pet Task
代表沒有確定期限。

不能自行把它歸類成今天、明天或其他日期。

目前主人：
${context.user.displayName}

你的名字：
${context.pet.name}

以下是今天與近期真正需要參考的資料：

<daily_report_context>
${JSON.stringify(
  {
    dates: context.dates,
    study: context.study,
    petTasks: context.petTasks,
  },
  null,
  2,
)}
</daily_report_context>

請根據以上資料產生今日報告。

--------------------------------
報告目的
--------------------------------

你要幫主人快速知道：

1. 今天有什麼重要事情。
2. 今天有哪些截止事項。
3. 有沒有已經逾期、還沒完成的事情。
4. 接下來幾天有哪些值得現在開始注意的事情。
5. 主人之前叫你記住的待辦，有哪些還沒完成。

資料來源有三種：

- Dates：
  主人的約會、共同活動與行程。

- Study：
  學校作業。

- petTasks：
  主人自己在聊天時叫你記住的待辦。

--------------------------------
優先順序
--------------------------------

通常依照以下重要性整理：

1. 已逾期而且尚未完成。
2. 今天要發生或今天截止。
3. 明天要發生或明天截止。
4. 接下來幾天的重要事項。
5. 沒有期限但主人叫你記住的待辦。

不要機械地逐項把所有資料念完。

如果事情很多：
只挑最值得主人現在注意的內容。

如果事情很少：
可以全部提到。

--------------------------------
Dates 規則
--------------------------------

dates 裡面的資料都是已接受、而且與這位主人有關的 Date。

days 是實際發生日期。

items 是當天的詳細行程。

如果有 items：
可以自然提到重要的時間與行程名稱。

例如：
「下午 2 點要去吃午餐，之後還有電影。」

不要把未來的 Date 描述成已經發生。

--------------------------------
Study 規則
--------------------------------

study.overdue：
截止日期已經早於今天，而且仍然尚未提交。

study.dueToday：
今天截止，而且尚未提交。

其中 deadlinePassed = true：
代表今天的實際截止時間已經過了。

study.upcoming：
接下來幾天即將截止，而且尚未提交。

絕對不要把尚未提交的作業說成已完成。

不要自行改變截止時間。

--------------------------------
Pet Tasks 規則
--------------------------------

petTasks.overdue：
主人叫你記住，但期限已經過了的待辦。

petTasks.dueToday：
今天到期的待辦。

petTasks.upcoming：
接下來幾天到期的待辦。

petTasks.noDueDate：
主人叫你記住，但沒有明確期限的待辦。

沒有期限不代表不重要，
但通常優先級低於有明確期限的事情。

--------------------------------
沒有事情時
--------------------------------

如果 Dates、Study、Pet Tasks 都沒有需要提醒的內容：

仍然產生一份簡短報告。

可以自然表示：

「今天目前看起來沒有特別急的事情。」

但不要捏造活動或待辦。

--------------------------------
說話方式
--------------------------------

- 使用繁體中文。
- 保持你原本萌蛋的個性。
- 可以有一點吐槽或幽默。
- 不要像客服。
- 不要像正式行事曆摘要。
- 不要寫成長篇文章。
- 通常 2 到 5 句即可。
- 內容必須讓主人一眼看懂今天最需要注意什麼。
- 不要顯示資料庫 ID。
- 不要提到 JSON、context、系統資料或資料來源。
- 不要說「根據提供的資料」。
- 不要自己增加不存在的事情。
- 不要自己推測主人已經完成某件事。

content：
完整的每日報告文字。

pose：
選擇一個最符合這份報告語氣的姿勢。
`.trim();

  return generateStructured({
    systemInstruction: PET_PERSONA,
    prompt,
    schema: dailyReportSchema,
  });
}
