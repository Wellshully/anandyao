import sharp from "sharp";
import { assertCutoutReady, cutoutDecorImage } from "./image-cutout-client";
import "server-only";

import { GoogleGenAI } from "@google/genai";

type Kind = "decor" | "room";

async function generatePetRewardImageOriginal(input: {
  kind: Kind;
  title: string;
  story: string;
  appearancePrompt?: string | null;
}): Promise<{
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg";
  extension: "png" | "jpg";
}> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing Gemini API key");
  }

  const ai = new GoogleGenAI({ apiKey });

  const artStyle = `Flat 2D Japanese anime sticker art
    for a cute virtual-pet mobile game.
    Similar to friendly emoji furniture icons:
    smooth crisp outlines, soft pastel colors,
    rounded silhouettes, clean cel shading,
    consistent charming hand-drawn illustration style.
    Strictly flat 2D. Not 3D, not clay, not photography,
    no realistic textures, no text, no logos, no watermark.`;

  const appearanceDetails = input.appearancePrompt?.trim()
    ? `Use these physical appearance details for the subject only;
       they must not override the fixed art style:
       ${input.appearancePrompt.trim()}`
    : "";

  const prompt = input.kind === "decor"
    ? `${artStyle}
       Draw exactly ONE standalone furniture or decoration sticker.
       Item: ${input.title}.
       Inspiration: ${input.story}.
       ${appearanceDetails}
       Square composition, fully visible, centered.
       Render this isolated object against a single plain pale-ivory backdrop for later AI segmentation.
       Never draw a checkerboard, transparency grid, or chroma-key magenta.
       Preserve the complete object silhouette and natural colors.
       No white box, no background scene, no pets, no characters.
       Keep the object recognizable at emoji size.`
    : `${artStyle}
       Draw a cozy 3:4 portrait anime room background.
       Setting: ${input.title}.
       Inspiration: ${input.story}.
       ${appearanceDetails}
       Front-facing environment with a decorated wall
       and a clearly visible floor.
       Leave a large, unobstructed central space
       for placing the virtual pet and movable furniture.
       No people, no pet, no text, no interface elements.`;

  const response = await ai.models.generateContent({
    model: process.env.PET_ADVENTURE_IMAGE_MODEL ||
      "gemini-3.1-flash-lite-image",
    contents: prompt,
    config: {
      abortSignal: AbortSignal.timeout(180_000),
      httpOptions: {
        timeout: 180_000,
        retryOptions: {
          attempts: 1,
        },
      },
      responseModalities: ["IMAGE"],
      imageConfig: {
        aspectRatio: input.kind === "decor" ? "1:1" : "3:4",
      },
    },
  });

  const part = response.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .find((candidatePart) =>
      !candidatePart.thought && candidatePart.inlineData?.data,
    );

  if (!part?.inlineData?.data) {
    throw new Error("Gemini returned no image");
  }

  const bytes = Buffer.from(part.inlineData.data, "base64");

  if (bytes.length < 1024 || bytes.length > 8 * 1024 * 1024) {
    throw new Error("Image size outside allowed limits");
  }

  const isPng = bytes.subarray(0, 8).equals(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );

  const isJpeg = bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;

  if (!isPng && !isJpeg) {
    throw new Error("Unsupported image bytes");
  }

  return {
    bytes,
    mimeType: isPng ? "image/png" : "image/jpeg",
    extension: isPng ? "png" : "jpg",
  };
}

// PET_ADVENTURE_ISNET_V35: Keep Worker/public API; use external V3 ISNet for furniture only.
export async function generatePetRewardImage(
  ...args: Parameters<typeof generatePetRewardImageOriginal>
): Promise<Awaited<ReturnType<typeof generatePetRewardImageOriginal>>> {
  const input = args[0];
  // Fail before spending on Gemini if the Python cutout service is unavailable.
  if (input.kind === "decor") {
    await assertCutoutReady();
  }
  const original = await generatePetRewardImageOriginal(...args);
  const png = input.kind === "decor"
    ? await cutoutDecorImage(original.bytes, original.mimeType)
    : await sharp(original.bytes).png().toBuffer();
  return {
    ...original,
    bytes: png,
    mimeType: "image/png",
    extension: "png",
  };
}
