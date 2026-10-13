import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export const COUPLE_QUESTS = [
  { title: "交換今天的小確幸", story: "萌蛋想知道你們今天的快樂！請各自分享一件讓自己微笑的小事，再問對方一個問題。聊完後，兩人各自確認。" },
  { title: "彼此的秘密歌單", story: "萌蛋今天想聽歌！請各自推薦一首符合今天心情的歌，告訴對方推薦理由，再一起選出今晚的主題曲。完成後各自確認。" },
  { title: "三分鐘回憶探險", story: "請輪流說出一段你們共同經歷過的有趣回憶，看看兩人記得的細節是否一樣。萌蛋正在旁邊偷聽呢！完成後各自確認。" },
  { title: "心情氣象站", story: "萌蛋想替你們播報心情天氣！兩個人各用一種天氣形容今天的心情，並告訴對方希望得到什麼陪伴。互相聽完後各自確認。" },
  { title: "今晚的奇妙二選一", story: "請各自出一道有趣的二選一題給對方，例如住海底或住雲端。輪流回答並解釋原因，看看你們多了解彼此！完成後各自確認。" },
  { title: "互相稱讚挑戰", story: "萌蛋今天要收集好話！兩人各自分享一件最近欣賞對方的具體小事，不需長篇大論。彼此聽完後各自確認。" },
  { title: "一起發明小約定", story: "請一起想出一項本週能做到、完全不花錢的小約定，例如晚安前交換一句今日心得。共同決定後，各自確認。" },
  { title: "預測對方的一天", story: "各自猜猜對方今天最想吃什麼或最想做什麼，讓對方公布答案，再聊聊為什麼。萌蛋會替你們記住這份默契！完成後各自確認。" },
] as const;

export function pickCoupleQuest(index: number) {
  return COUPLE_QUESTS[((index % COUPLE_QUESTS.length) + COUPLE_QUESTS.length) % COUPLE_QUESTS.length];
}

const schema = z.object({
  title: z.string().trim().min(4).max(28),
  story: z.string().trim().min(30).max(200),
});

export async function generateCoupleQuest(
  fallbackTitle: string,
  fallbackStory: string,
  testRound: number,
): Promise<z.infer<typeof schema>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: process.env.AI_MODEL || "gemini-3.1-flash-lite",
    contents: `你是情侶兩人共同養的虛擬寵物「萌蛋」，以溫暖、俏皮但不幼稚的繁體中文提出一個「讓兩人實際互動」的每日小任務。
必須是兩人都能參與、日常不花錢、5 分鐘內能完成的交流遊戲。
主題可以是：了解彼此、趣味問答、回憶、默契、互相分享心情、觀察身邊的小事、合作創作或友善小挑戰。
任務內容要有清楚的步驟與客觀的共同完成點，但由兩人自己按確認，AI 不判定是否完成。
避免要求提供私人資料、拍照上傳、公開隱私、冒險、花錢、強迫感情揭露或有壓力的行為。避免重複單純說謝謝或稱讚的任務。
本輪次 ${testRound}；以「${fallbackTitle}」的氛圍作為參考，但設計出新的趣味互動。參考內容：${fallbackStory}
只輸出 JSON，包含 title 與 story，story 末尾提醒「完成後請兩人各自確認」。`,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        properties: { title: { type: "string" }, story: { type: "string" } },
        required: ["title", "story"],
        additionalProperties: false,
      },
      maxOutputTokens: 480,
    },
  });
  const parsed = schema.parse(JSON.parse(response.text ?? ""));
  if (!/[一-龥]/u.test(parsed.title)) throw new Error("Unexpected task language");
  return parsed;
}
