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

export async function generatePetDailyReport(
  context: PetDailyReportContext,
): Promise<GeneratedPetDailyReport> {
  const prompt = `
你現在要替主人產生「每日報告」。

這不是聊天回覆。
這是一份每天固定時間主動提供給主人的簡短生活提醒。

目前日期：
${context.currentDate}

資料涵蓋到：
${context.throughDate}

時區：
${context.timeZone}

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
