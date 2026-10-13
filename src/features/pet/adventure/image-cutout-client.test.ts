import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { validateCutoutPng } from "./image-cutout-client";

async function pngWithObject(backgroundAlpha: number) {
  const base = await sharp({
    create: {
      width: 1024, height: 1024, channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: backgroundAlpha },
    },
  }).png().toBuffer();
  return sharp(base).composite([{
    input: { create: { width: 400, height: 450, channels: 4,
      background: { r: 120, g: 180, b: 80, alpha: 1 } } },
    left: 312, top: 287,
  }]).png().toBuffer();
}

describe("ISNet cutout PNG validation", () => {
  it("accepts an RGBA PNG with a visible isolated object", async () => {
    const bytes = await pngWithObject(0);
    const validated = await validateCutoutPng(bytes);
    expect((await sharp(validated).metadata()).hasAlpha).toBe(true);
  });

  it("rejects a PNG with no transparent background", async () => {
    await expect(validateCutoutPng(await pngWithObject(1))).rejects.toThrow();
  });

  it("rejects JPEG even if it is renamed as PNG", async () => {
    const jpeg = await sharp({
      create: { width: 1024, height: 1024, channels: 3, background: "white" },
    }).jpeg().toBuffer();
    await expect(validateCutoutPng(jpeg)).rejects.toThrow();
  });
});
