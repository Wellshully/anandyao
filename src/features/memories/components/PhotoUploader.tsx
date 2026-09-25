"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createMediaPath } from "@/lib/media/create-media-path";
import { createClient } from "@/lib/supabase/client";
import { optimizeImage } from "@/features/memories/lib/optimize-image";

type PhotoUploaderProps = {
  memoryId: string;
  spaceId: string;
  currentCount: number;
};

export default function PhotoUploader({
  memoryId,
  spaceId,
  currentCount,
}: PhotoUploaderProps) {
  const router = useRouter();

  const inputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);

  const [message, setMessage] = useState<string | null>(null);

  async function uploadPhoto(source: File, sortOrder: number) {
    const supabase = createClient();

    const optimized = await optimizeImage(source);

    const storagePath = createMediaPath({
      spaceId,
      category: "memories",
      extension: "webp",
    });

    const { error: storageError } = await supabase.storage
      .from("media")
      .upload(storagePath, optimized.file, {
        contentType: "image/webp",

        cacheControl: "31536000",

        upsert: false,
      });

    if (storageError) {
      throw storageError;
    }

    const { data: media, error: mediaError } = await supabase
      .from("media")
      .insert({
        space_id: spaceId,
        storage_path: storagePath,

        file_name: source.name,

        mime_type: optimized.file.type,

        file_size: optimized.file.size,

        width: optimized.width,

        height: optimized.height,
      })
      .select("id")
      .single();

    if (mediaError) {
      await supabase.storage.from("media").remove([storagePath]);

      throw mediaError;
    }

    const { error: linkError } = await supabase.from("memory_media").insert({
      memory_id: memoryId,
      media_id: media.id,
      sort_order: sortOrder,
    });

    if (linkError) {
      await supabase.from("media").delete().eq("id", media.id);

      await supabase.storage.from("media").remove([storagePath]);

      throw linkError;
    }
  }

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    if (files.length > 20) {
      setMessage("Please upload at most 20 photos at once.");

      return;
    }

    setUploading(true);
    setMessage(null);

    let successCount = 0;

    try {
      for (let index = 0; index < files.length; index += 1) {
        try {
          await uploadPhoto(files[index], currentCount + successCount);

          successCount += 1;
        } catch (error) {
          console.error(error);
        }
      }

      if (successCount === files.length) {
        setMessage(`${successCount} photo(s) uploaded.`);
      } else {
        setMessage(`${successCount} of ${files.length} photo(s) uploaded.`);
      }

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-5">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
        multiple
        disabled={uploading}
        onChange={handleFiles}
        className="block w-full text-sm"
      />

      <p className="mt-2 text-xs text-neutral-500">Upload.</p>

      {uploading && <p className="mt-3 text-sm">Processing photos...</p>}

      {message && <p className="mt-3 text-sm text-neutral-600">{message}</p>}
    </div>
  );
}
