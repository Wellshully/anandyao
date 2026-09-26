import "server-only";

import { z, type ZodType } from "zod";

import { AI_CONFIG } from "@/lib/ai/config";

import { getAiClient } from "@/lib/ai/client";

type GenerateStructuredOptions<T> = {
  systemInstruction?: string;
  prompt: string;
  schema: ZodType<T>;
  model?: string;
};

export async function generateStructured<T>({
  systemInstruction,
  prompt,
  schema,
  model = AI_CONFIG.model,
}: GenerateStructuredOptions<T>): Promise<T> {
  const ai = getAiClient();

  const response = await ai.models.generateContent({
    model,

    contents: prompt,

    config: {
      systemInstruction,

      responseMimeType: "application/json",

      responseJsonSchema: z.toJSONSchema(schema),

      maxOutputTokens: AI_CONFIG.maxOutputTokens,
    },
  });

  const text = response.text?.trim();

  if (!text) {
    throw new Error("AI returned no output.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("AI returned invalid JSON.");
  }

  return schema.parse(parsed);
}
