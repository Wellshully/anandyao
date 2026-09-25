const MAX_SIZE = 1920;

const TARGET_SIZE_BYTES = 500 * 1024;

const INITIAL_QUALITY = 0.78;

const MIN_QUALITY = 0.5;

const QUALITY_STEP = 0.07;

const RESIZE_FACTOR = 0.85;

const MIN_LONG_EDGE = 960;

type OptimizedImage = {
  file: File;
  width: number;
  height: number;
};

type EncodedImage = {
  blob: Blob;
  extension: "webp" | "jpg";
};

type CompressionResult = EncodedImage & {
  width: number;
  height: number;
};

function isHeicLike(file: File) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  return (
    type === "image/heic" ||
    type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

async function convertHeicToJpeg(source: File): Promise<File> {
  const { heicTo } = await import("heic-to");

  const converted = await heicTo({
    blob: source,
    type: "image/jpeg",

    /*
     * 這張 JPEG 只是給瀏覽器 decode 用，
     * 不會直接上傳。
     */
    quality: 0.88,
  });

  if (!(converted instanceof Blob)) {
    throw new Error("HEIC 轉換失敗。");
  }

  const baseName = source.name.replace(/\.[^.]+$/, "");

  return new File([converted], `${baseName}.jpg`, {
    type: "image/jpeg",
  });
}

function loadImage(source: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("無法讀取圖片。"));
    };

    image.src = url;
  });
}

function getTargetSize(width: number, height: number) {
  if (width <= MAX_SIZE && height <= MAX_SIZE) {
    return {
      width,
      height,
    };
  }

  const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);

  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

function createCanvas(image: HTMLImageElement, width: number, height: number) {
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("無法處理圖片。");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  /*
   * JPEG 沒有透明背景。
   * 對照片來說白色背景最安全，
   * 也避免透明 PNG 轉 JPEG 後變黑。
   */
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  context.drawImage(image, 0, 0, width, height);

  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("圖片壓縮失敗。"));
          return;
        }

        resolve(blob);
      },
      type,
      quality,
    );
  });
}

async function encodeImage(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<EncodedImage> {
  /*
   * 先嘗試 WebP。
   *
   * 重要：
   * 不能因為 request image/webp 就假設回來一定
   * 是 WebP。瀏覽器不支援時可能 fallback 成 PNG。
   */
  const webpBlob = await canvasToBlob(canvas, "image/webp", quality);

  /*
   * JPEG encoder 是最穩定的 fallback。
   */
  const jpegBlob = await canvasToBlob(canvas, "image/jpeg", quality);

  const candidates: EncodedImage[] = [
    {
      blob: jpegBlob,
      extension: "jpg",
    },
  ];

  /*
   * 只有真正回傳 image/webp 才接受。
   */
  if (webpBlob.type === "image/webp") {
    candidates.push({
      blob: webpBlob,
      extension: "webp",
    });
  }

  /*
   * WebP 不一定在每張照片上都比 JPEG 小，
   * 所以直接選實際 bytes 較小的結果。
   */
  candidates.sort((a, b) => a.blob.size - b.blob.size);

  return candidates[0];
}

async function compressImage(
  image: HTMLImageElement,
  initialWidth: number,
  initialHeight: number,
): Promise<CompressionResult> {
  let width = initialWidth;
  let height = initialHeight;

  let smallestResult: CompressionResult | null = null;

  while (true) {
    const canvas = createCanvas(image, width, height);

    for (
      let quality = INITIAL_QUALITY;
      quality >= MIN_QUALITY;
      quality -= QUALITY_STEP
    ) {
      const encoded = await encodeImage(canvas, quality);

      const current: CompressionResult = {
        ...encoded,
        width,
        height,
      };

      if (!smallestResult || current.blob.size < smallestResult.blob.size) {
        smallestResult = current;
      }

      if (encoded.blob.size <= TARGET_SIZE_BYTES) {
        return current;
      }
    }

    const longEdge = Math.max(width, height);

    if (longEdge <= MIN_LONG_EDGE) {
      if (!smallestResult) {
        throw new Error("圖片壓縮失敗。");
      }

      return smallestResult;
    }

    const nextLongEdge = Math.max(
      MIN_LONG_EDGE,
      Math.round(longEdge * RESIZE_FACTOR),
    );

    const ratio = nextLongEdge / longEdge;

    const nextWidth = Math.max(1, Math.round(width * ratio));

    const nextHeight = Math.max(1, Math.round(height * ratio));

    if (nextWidth === width && nextHeight === height) {
      if (!smallestResult) {
        throw new Error("圖片壓縮失敗。");
      }

      return smallestResult;
    }

    width = nextWidth;

    height = nextHeight;
  }
}

export async function optimizeImage(source: File): Promise<OptimizedImage> {
  let workingFile = source;

  if (isHeicLike(source)) {
    workingFile = await convertHeicToJpeg(source);
  }

  const image = await loadImage(workingFile);

  const initialSize = getTargetSize(image.naturalWidth, image.naturalHeight);

  const optimized = await compressImage(
    image,
    initialSize.width,
    initialSize.height,
  );

  const baseName = source.name.replace(/\.[^.]+$/, "");

  const mimeType = optimized.extension === "webp" ? "image/webp" : "image/jpeg";

  const file = new File(
    [optimized.blob],
    `${baseName}.${optimized.extension}`,
    {
      type: mimeType,
    },
  );

  /*
   * 測試階段先保留。
   * 確認手機行為正常後可以刪掉。
   */
  console.log("[optimizeImage]", {
    source: {
      name: source.name,

      type: source.type,

      sizeKB: Math.round(source.size / 1024),

      width: image.naturalWidth,

      height: image.naturalHeight,
    },

    optimized: {
      name: file.name,

      type: file.type,

      sizeKB: Math.round(file.size / 1024),

      width: optimized.width,

      height: optimized.height,
    },
  });

  return {
    file,
    width: optimized.width,

    height: optimized.height,
  };
}
