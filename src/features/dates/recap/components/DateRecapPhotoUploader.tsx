"use client";

import Image from "next/image";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

import { createMediaPath } from "@/lib/media/create-media-path";

import { optimizeImage } from "@/features/memories/lib/optimize-image";

import type { DateRecapPhoto } from "@/features/dates/recap/photo-types";

import {
  deleteDateRecapPhotoAction,
} from "@/features/dates/recap/actions";

import {
  shouldOpenRecapPhotoMenuOnClick,
} from "@/features/dates/recap/lib/should-open-photo-menu-on-click";

type UploadState = {
  id: string;

  name: string;

  status: "waiting" | "processing" | "uploading" | "done" | "error";

  error?: string;
};

type DateRecapPhotoUploaderProps = {
  recapId: string;

  spaceId: string;

  photos: DateRecapPhoto[];
};

export default function DateRecapPhotoUploader({
  recapId,
  spaceId,
  photos,
}: DateRecapPhotoUploaderProps) {
  const router = useRouter();

  const supabase = createClient();

  const inputRef = useRef<HTMLInputElement>(null);

  const [uploads, setUploads] = useState<UploadState[]>([]);

  const [isUploading, setIsUploading] = useState(false);

  const [selectedMediaId, setSelectedMediaId] =
    useState<string | null>(null);

  const [deletingMediaId, setDeletingMediaId] =
    useState<string | null>(null);

  const [photoError, setPhotoError] =
    useState<string | null>(null);

  const [hiddenMediaIds, setHiddenMediaIds] =
    useState<string[]>([]);

  const pressTimerRef = useRef<number | null>(null);

  const lastPointerTypeRef = useRef<string | null>(null);

  const pressStartRef = useRef<{
    x: number;
    y: number;
  } | null>(null);

  const visiblePhotos = photos.filter(
    (photo) => !hiddenMediaIds.includes(photo.mediaId),
  );

  function clearPressTimer() {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }

    pressStartRef.current = null;
  }

  useEffect(() => {
    return () => {
      if (pressTimerRef.current !== null) {
        window.clearTimeout(pressTimerRef.current);
      }
    };
  }, []);

  function beginLongPress(
    event: ReactPointerEvent<HTMLButtonElement>,
    mediaId: string,
  ) {
    clearPressTimer();
    lastPointerTypeRef.current = event.pointerType;

    if (
      isUploading ||
      deletingMediaId !== null ||
      !["touch", "pen"].includes(event.pointerType)
    ) {
      return;
    }

    pressStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };

    pressTimerRef.current = window.setTimeout(() => {
      setPhotoError(null);
      setSelectedMediaId(mediaId);
      pressTimerRef.current = null;
    }, 550);
  }

  function trackLongPress(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const start = pressStartRef.current;

    if (
      start &&
      Math.hypot(
        event.clientX - start.x,
        event.clientY - start.y,
      ) > 12
    ) {
      clearPressTimer();
    }
  }

  async function handleDeletePhoto(photo: DateRecapPhoto) {
    if (deletingMediaId !== null || isUploading) {
      return;
    }

    setDeletingMediaId(photo.mediaId);
    setPhotoError(null);

    try {
      const result = await deleteDateRecapPhotoAction({
        recapId,
        mediaId: photo.mediaId,
      });

      if (!result.success) {
        setPhotoError(result.error);
        return;
      }

      setHiddenMediaIds((current) => [
        ...current,
        photo.mediaId,
      ]);

      setSelectedMediaId(null);
      router.refresh();
    } catch (cause) {
      setPhotoError(
        cause instanceof Error
          ? cause.message
          : "刪除照片失敗。",
      );
    } finally {
      setDeletingMediaId(null);
    }
  }

  function updateUpload(id: string, patch: Partial<UploadState>) {
    setUploads((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
            }
          : item,
      ),
    );
  }

  async function getNextSortOrder() {
    const { data, error } = await supabase
      .from("date_recap_media")
      .select("sort_order")
      .eq("recap_id", recapId)
      .order("sort_order", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return (data?.sort_order ?? -1) + 1;
  }

  async function uploadOne(source: File, uploadId: string, sortOrder: number) {
    updateUpload(uploadId, {
      status: "processing",
    });

    const optimized = await optimizeImage(source);

    updateUpload(uploadId, {
      status: "uploading",
    });

    const storagePath = createMediaPath({
      spaceId,

      /*
       * Recap photos eventually become
       * Memory photos, so keep using the
       * existing memories namespace.
       */
      category: "memories",

      extension: "webp",
    });

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(storagePath, optimized.file, {
        contentType: "image/webp",

        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: media, error: mediaError } = await supabase
      .from("media")
      .insert({
        space_id: spaceId,

        storage_path: storagePath,

        /*
         * Keep the user's original
         * filename, including .HEIC.
         */
        file_name: source.name,

        mime_type: optimized.file.type,

        file_size: optimized.file.size,

        width: optimized.width,

        height: optimized.height,
      })
      .select("id")
      .single();

    if (mediaError || !media) {
      await supabase.storage.from("media").remove([storagePath]);

      throw new Error(mediaError?.message ?? "無法建立圖片資料。");
    }

    const { error: linkError } = await supabase
      .from("date_recap_media")
      .insert({
        recap_id: recapId,

        media_id: media.id,

        sort_order: sortOrder,
      });

    if (linkError) {
      await supabase.from("media").delete().eq("id", media.id);

      await supabase.storage.from("media").remove([storagePath]);

      throw new Error(linkError.message);
    }

    updateUpload(uploadId, {
      status: "done",
    });
  }

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    const newUploads = files.map((file) => ({
      id: crypto.randomUUID(),

      name: file.name,

      status: "waiting" as const,
    }));

    setUploads(newUploads);

    setIsUploading(true);

    let nextSortOrder = await getNextSortOrder();

    /*
     * Intentionally sequential.
     *
     * HEIC conversion can use a lot of
     * memory on an iPhone, so we do not
     * convert many large photos at once.
     */
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];

      const upload = newUploads[index];

      try {
        await uploadOne(file, upload.id, nextSortOrder);

        nextSortOrder += 1;

        /*
         * Reconcile with the server after
         * every successful photo.
         */
        router.refresh();
      } catch (cause) {
        console.error("Recap photo upload:", cause);

        updateUpload(upload.id, {
          status: "error",

          error: cause instanceof Error ? cause.message : "上傳失敗",
        });
      }
    }

    setIsUploading(false);

    router.refresh();
  }

  return (
    <section>
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
        Photos
      </p>

      <div className="mt-2 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-story text-2xl font-semibold">放幾張照片吧</h2>
        </div>

        <button
          type="button"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          className="
            shrink-0
            rounded-xl
            border
            border-[var(--border)]
            px-4
            py-3
            text-sm
            font-medium
            transition
            hover:border-[var(--foreground)]
            disabled:opacity-50
          "
        >
          + 加入照片
        </button>
      </div>

      <p className="mt-3 text-xs text-[var(--muted)]">
        手機長按照片，或在電腦上點擊照片，即可開啟刪除選單。
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="
          image/jpeg,
          image/png,
          image/webp,
          image/heic,
          image/heif,
          .jpg,
          .jpeg,
          .png,
          .webp,
          .heic,
          .heif
        "
        onChange={handleFiles}
        className="hidden"
      />

      {visiblePhotos.length > 0 && (
        <div
          className="
            mt-6
            grid
            grid-cols-2
            gap-3
            sm:grid-cols-3
          "
        >
          {visiblePhotos.map((photo) => (
            <div
              key={photo.mediaId}
              className="relative aspect-square overflow-hidden rounded-[var(--radius-md)] bg-[var(--surface-soft)]"
            >
              <button
                type="button"
                aria-label={`管理照片：${photo.fileName}，可長按或按右鍵`}
                className="absolute inset-0 block h-full w-full touch-manipulation select-none"
                onPointerDown={(event) =>
                  beginLongPress(event, photo.mediaId)
                }
                onPointerMove={trackLongPress}
                onPointerUp={clearPressTimer}
                onPointerCancel={clearPressTimer}
                onPointerLeave={clearPressTimer}
                onContextMenu={(event) => {
                  event.preventDefault();
                  clearPressTimer();
                  setPhotoError(null);
                  setSelectedMediaId(photo.mediaId);
                }}
                onClick={(event) => {
                  if (
                    !isUploading &&
                    deletingMediaId === null &&
                    shouldOpenRecapPhotoMenuOnClick(
                      event.detail,
                      lastPointerTypeRef.current,
                    )
                  ) {
                    setPhotoError(null);
                    setSelectedMediaId(photo.mediaId);
                  }
                }}
              >
                {photo.signedUrl && (
                  <Image
                    src={photo.signedUrl}
                    alt={photo.fileName}
                    fill
                    unoptimized
                    draggable={false}
                    sizes="(max-width: 640px) 50vw, 220px"
                    className="pointer-events-none select-none object-cover"
                  />
                )}
              </button>

              {selectedMediaId === photo.mediaId && (
                <div className="absolute inset-0 z-10 flex flex-col justify-end gap-2 bg-black/70 p-3 text-white">
                  <p className="text-center text-xs">
                    要刪除這張照片嗎？
                  </p>

                  <button
                    type="button"
                    disabled={deletingMediaId !== null || isUploading}
                    onClick={() => void handleDeletePhoto(photo)}
                    className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                  >
                    {deletingMediaId === photo.mediaId
                      ? "正在刪除…"
                      : "刪除照片"}
                  </button>

                  <button
                    type="button"
                    disabled={deletingMediaId !== null}
                    onClick={() => {
                      setSelectedMediaId(null);
                      setPhotoError(null);
                    }}
                    className="rounded-lg border border-white/60 px-3 py-2 text-sm"
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {photoError && (
        <p role="alert" className="mt-3 text-sm text-[var(--danger)]">
          {photoError}
        </p>
      )}

      {uploads.length > 0 && (
        <div className="mt-5 space-y-2">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="
                  flex
                  items-center
                  justify-between
                  gap-4
                  rounded-xl
                  bg-[var(--surface-soft)]
                  px-4
                  py-3
                "
            >
              <p className="min-w-0 truncate text-xs">{upload.name}</p>

              <p
                className={`
                    shrink-0
                    text-xs

                    ${
                      upload.status === "error"
                        ? "text-[var(--danger)]"
                        : "text-[var(--muted)]"
                    }
                  `}
              >
                {upload.status === "waiting" && "等待中"}

                {upload.status === "processing" && "處理照片中…"}

                {upload.status === "uploading" && "上傳中…"}

                {upload.status === "done" && "完成 ✓"}

                {upload.status === "error" && (upload.error ?? "失敗")}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
