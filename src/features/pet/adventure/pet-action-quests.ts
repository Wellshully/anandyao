import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { ACTION_LABELS, type QuestAction } from "./catalog";

const petQuestSchema = z.object({
  title: z.string().trim().min(4).max(28),
  story: z.string().trim().min(20).max(140),
});

export async function generatePetActionQuest(
  fallbackTitle: string,
  fallbackStory: string,
  testRound: number,
  action: QuestAction,
  goal: number,
): Promise<{ title: string; story: string }> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const label = ACTION_LABELS[action];
  const client = new GoogleGenAI({ apiKey });

  const response = await client.models.generateContent({
    model: process.env.AI_MODEL || "gemini-3.1-flash-lite",

    contents: `你是兩人共同養的虛擬寵物「萌蛋」。

請用繁體中文設計有趣、活潑、溫馨的日常照顧任務。

這次是一般萌蛋互動任務，不是情侶雙人任務。
玩家不需要互相確認完成。

系統已決定真正的完成條件：
玩家在 /pet 頁面按「${label}」按鈕 ${goal} 次。

你只能生成任務標題 title 和故事 story。
不能改變操作類型、完成次數或加入其他完成要求。

請以萌蛋的第一人稱口吻提出任務，內容要有創意，
例如太空探險、秘密基地、魔法研究、運動會、
幻想旅行、小小日常挑戰等。

不要每次都只是「我餓了」或「陪我玩」。

故事長度約 20～140 字。
不要要求上傳照片、揭露隱私、花錢或做危險行為。
不要要求兩位玩家各自確認。

本次輪次：${testRound}
參考氛圍：${fallbackTitle}
參考故事：${fallbackStory}

請只輸出 JSON，包含 title 和 story。`,

    config: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          story: { type: "string" },
        },
        required: ["title", "story"],
        additionalProperties: false,
      },
      maxOutputTokens: 480,
    },
  });

  const generated = petQuestSchema.parse(
    JSON.parse(response.text ?? ""),
  );

  if (!/[一-龥]/u.test(generated.title)) {
    throw new Error("Unexpected task language");
  }

  // 完成條件由伺服器固定，不由 AI 決定。
  const instruction = `請到萌蛋頁面按「${label}」${goal} 次。`;

  return {
    title: generated.title,
    story: `${generated.story}\\n${instruction}`,
  };
}
