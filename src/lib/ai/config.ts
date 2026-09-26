import "server-only";

export const AI_CONFIG = {
  provider: "gemini",

  model: process.env.AI_MODEL ?? "gemini-3.1-flash-lite",

  maxUserMessageLength: 500,

  maxOutputTokens: 180,
} as const;
