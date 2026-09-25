const MAX_SIZE = 1920;

const TARGET_SIZE_BYTES = 500 * 1024;

const INITIAL_WEBP_QUALITY = 0.8;

const MIN_WEBP_QUALITY = 0.56;

const QUALITY_STEP = 0.06;

const RESIZE_FACTOR = 0.85;

const MIN_LONG_EDGE = 1280;

type OptimizedImage = {
  file: File;
  width: number;
  height: number;
};

type CompressionResult = {
  blob: Blob;
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

  /*
   * This JPEG is only an intermediate
   * representation so the browser can
   * draw the HEIC photo onto a canvas.
   *
   * It is never uploaded.
   */
  const converted = await heicTo({
    blob: source,

    type: "image/jpeg",

    quality: 0.9,
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

  /*
   * Give the browser high-quality scaling
   * when shrinking large phone photos.
   */
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  context.drawImage(image, 0, 0, width, height);

  return canvas;
}

function canvasToWebp(
  canvas: HTMLCanvasElement,
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

      "image/webp",

      quality,
    );
  });
}

async function compressImage(
  image: HTMLImageElement,
  initialWidth: number,
  initialHeight: number,
): Promise<CompressionResult> {
  let width = initialWidth;
  let height = initialHeight;

  /*
   * Keep the most recent result so we can
   * still return a usable image if an
   * unusually detailed photo cannot reach
   * the exact target size.
   */
  let lastBlob: Blob | null = null;

  while (true) {
    const canvas = createCanvas(image, width, height);

    /*
     * First try to preserve resolution and
     * progressively lower WebP quality.
     */
    for (
      let quality = INITIAL_WEBP_QUALITY;
      quality >= MIN_WEBP_QUALITY;
      quality -= QUALITY_STEP
    ) {
      const blob = await canvasToWebp(canvas, quality);

      lastBlob = blob;

      if (blob.size <= TARGET_SIZE_BYTES) {
        return {
          blob,
          width,
          height,
        };
      }
    }

    const longEdge = Math.max(width, height);

    /*
     * Do not keep shrinking forever.
     * 1280px is still enough for normal
     * Memories / Date recap display.
     */
    if (longEdge <= MIN_LONG_EDGE) {
      if (!lastBlob) {
        throw new Error("圖片壓縮失敗。");
      }

      return {
        blob: lastBlob,
        width,
        height,
      };
    }

    /*
     * Quality alone was not enough.
     * Reduce resolution and try again.
     */
    const nextLongEdge = Math.max(
      MIN_LONG_EDGE,
      Math.round(longEdge * RESIZE_FACTOR),
    );

    const ratio = nextLongEdge / longEdge;

    const nextWidth = Math.max(1, Math.round(width * ratio));

    const nextHeight = Math.max(1, Math.round(height * ratio));

    /*
     * Safety against an accidental infinite
     * loop caused by rounding.
     */
    if (nextWidth === width && nextHeight === height) {
      if (!lastBlob) {
        throw new Error("圖片壓縮失敗。");
      }

      return {
        blob: lastBlob,
        width,
        height,
      };
    }

    width = nextWidth;
    height = nextHeight;
  }
}

export async function optimizeImage(source: File): Promise<OptimizedImage> {
  let workingFile = source;

  /*
   * Safari / Canvas cannot reliably consume
   * every HEIC file directly, so decode it
   * first.
   */
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

  const file = new File([optimized.blob], `${baseName}.webp`, {
    type: "image/webp",
  });

  return {
    file,
    width: optimized.width,
    height: optimized.height,
  };
}
