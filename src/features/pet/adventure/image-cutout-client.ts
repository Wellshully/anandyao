import sharp from "sharp";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function getCutoutSettings() {
  const rawUrl = process.env.PET_ADVENTURE_CUTOUT_URL?.trim();
  const token = process.env.PET_ADVENTURE_CUTOUT_TOKEN?.trim();
  if (!rawUrl || !token || token.length < 32) {
    throw new Error("Cutout service is not configured (URL and >=32-character token required)");
  }
  const url = new URL(rawUrl);
  const isLocal = (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal && process.env.NODE_ENV !== "production")) {
    throw new Error("Cutout service requires HTTPS");
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("Cutout URL must be a bare service origin without credentials, query or path");
  }
  return { url, token };
}

/** Used before claiming the daily paid-image quota: fail closed if unavailable. */
export async function assertCutoutReady(): Promise<void> {
  const { url, token } = getCutoutSettings();
  const response = await fetch(new URL("/ready", url), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    throw new Error(`ISNet cutout service is unavailable (HTTP ${response.status})`);
  }
}

/** Reject any opaque, undersized, huge, or almost-empty output before Storage upload. */
export async function validateCutoutPng(input: Uint8Array): Promise<Buffer> {
  const bytes = Buffer.from(input);
  if (bytes.length < 1_024 || bytes.length > 12 * 1024 * 1024 ||
      !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("ISNet cutout returned invalid PNG bytes");
  }
  const info = await sharp(bytes, { failOn: "error" }).metadata();
  if (info.format !== "png" || info.width !== 1024 || info.height !== 1024 || !info.hasAlpha) {
    throw new Error("ISNet cutout must return 1024x1024 RGBA PNG");
  }
  const { data, info: raw } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0;
  let visible = 0;
  const total = raw.width * raw.height;
  for (let i = 3; i < data.length; i += raw.channels) {
    if (data[i] < 24) transparent++;
    if (data[i] >= 192) visible++;
  }
  const t = transparent / total;
  const v = visible / total;
  if (!(t > 0.08 && t < 0.97 && v > 0.025 && v < 0.88)) {
    throw new Error(`ISNet mask fails quality limits (transparent=${t.toFixed(3)}, visible=${v.toFixed(3)})`);
  }
  return bytes;
}

export async function cutoutDecorImage(input: Uint8Array, mimeType: "image/jpeg" | "image/png"): Promise<Buffer> {
  const { url, token } = getCutoutSettings();
  const bytes = Buffer.from(input);
  if (bytes.length < 1024 || bytes.length > 8 * 1024 * 1024) {
    throw new Error("Gemini image outside cutout input limits");
  }
  const response = await fetch(new URL("/cutout", url), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": mimeType,
      Accept: "image/png",
    },
    body: new Uint8Array(bytes),
    cache: "no-store",
    signal: AbortSignal.timeout(65_000),
  });
  if (!response.ok) {
    throw new Error(`ISNet cutout failed (HTTP ${response.status}); Gemini output was not uploaded`);
  }
  const length = Number(response.headers.get("content-length") ?? "0");
  if (length > 12 * 1024 * 1024) {
    throw new Error("ISNet response too large");
  }
  const output = new Uint8Array(await response.arrayBuffer());
  return validateCutoutPng(output);
}
