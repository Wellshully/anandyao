const MAX_SIZE = 1920;
const WEBP_QUALITY = 0.82;

type OptimizedImage = {
  file: File;
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
     * This is only an intermediate image.
     * The final output is still WebP .82.
     */
    quality: 0.92,
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

function canvasToWebp(canvas: HTMLCanvasElement): Promise<Blob> {
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

      WEBP_QUALITY,
    );
  });
}

export async function optimizeImage(source: File): Promise<OptimizedImage> {
  let workingFile = source;

  if (isHeicLike(source)) {
    workingFile = await convertHeicToJpeg(source);
  }

  const image = await loadImage(workingFile);

  const { width, height } = getTargetSize(
    image.naturalWidth,
    image.naturalHeight,
  );

  const canvas = document.createElement("canvas");

  canvas.width = width;

  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("無法處理圖片。");
  }

  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToWebp(canvas);

  const baseName = source.name.replace(/\.[^.]+$/, "");

  const file = new File([blob], `${baseName}.webp`, {
    type: "image/webp",
  });

  return {
    file,
    width,
    height,
  };
}
