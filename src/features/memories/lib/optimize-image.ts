const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const MAX_DIMENSION = 1920;
const WEBP_QUALITY = 0.82;

type OptimizedImage = {
  file: File;
  width: number;
  height: number;
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);

    image.onerror = () => reject(new Error("Unable to decode image."));

    image.src = url;
  });
}

export async function optimizeImage(source: File): Promise<OptimizedImage> {
  if (!SUPPORTED_TYPES.includes(source.type)) {
    throw new Error("Only JPEG, PNG and WebP images are supported.");
  }

  const objectUrl = URL.createObjectURL(source);

  try {
    const image = await loadImage(objectUrl);

    const originalWidth = image.naturalWidth;

    const originalHeight = image.naturalHeight;

    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(originalWidth, originalHeight),
    );

    const width = Math.round(originalWidth * scale);

    const height = Math.round(originalHeight * scale);

    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas is not supported.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (!result) {
            reject(new Error("Image compression failed."));

            return;
          }

          resolve(result);
        },
        "image/webp",
        WEBP_QUALITY,
      );
    });

    const baseName = source.name.replace(/\.[^/.]+$/, "");

    const file = new File([blob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });

    return {
      file,
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
