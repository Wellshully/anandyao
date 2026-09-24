import { notFound } from "next/navigation";

import MemoryDetail from "@/features/memories/components/MemoryDetail";

import { requireSpace } from "@/lib/space/require-space";

import { createClient } from "@/lib/supabase/server";

import { deleteMemory, deleteMemoryPhoto, updateMemory } from "./actions";

type MemoryPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function MemoryPage({ params }: MemoryPageProps) {
  const { id } = await params;

  const space = await requireSpace();

  const supabase = await createClient();

  const { data: memory, error: memoryError } = await supabase
    .from("memories")
    .select(
      `
        id,
        title,
        body,
        memory_date,
        location_name
      `,
    )
    .eq("id", id)
    .eq("space_id", space.id)
    .maybeSingle();

  if (memoryError || !memory) {
    notFound();
  }

  const { data: links, error: linksError } = await supabase
    .from("memory_media")
    .select(
      `
        media_id,
        sort_order,
        caption
      `,
    )
    .eq("memory_id", memory.id)
    .order("sort_order", {
      ascending: true,
    });

  if (linksError) {
    throw linksError;
  }

  const mediaIds = links.map((item) => item.media_id);

  const { data: mediaRows } =
    mediaIds.length > 0
      ? await supabase
          .from("media")
          .select(
            `
              id,
              storage_path,
              file_name,
              alt_text,
              width,
              height
            `,
          )
          .in("id", mediaIds)
      : {
          data: [],
        };

  const mediaMap = new Map(mediaRows?.map((media) => [media.id, media]) ?? []);

  const orderedMedia = links
    .map((link) => {
      const media = mediaMap.get(link.media_id);

      if (!media) {
        return null;
      }

      return {
        ...media,

        sortOrder: link.sort_order,

        caption: link.caption,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const paths = orderedMedia.map((item) => item.storage_path);

  const { data: signedUrls } =
    paths.length > 0
      ? await supabase.storage.from("media").createSignedUrls(paths, 60 * 60)
      : {
          data: [],
        };

  const signedUrlMap = new Map(
    signedUrls?.map((item) => [item.path, item.signedUrl]) ?? [],
  );

  const photos = orderedMedia
    .map((media) => {
      const signedUrl = signedUrlMap.get(media.storage_path);

      if (!signedUrl) {
        return null;
      }

      return {
        id: media.id,

        signedUrl,

        altText: media.alt_text,
      };
    })
    .filter((photo): photo is NonNullable<typeof photo> => photo !== null);

  return (
    <MemoryDetail
      memory={memory}
      photos={photos}
      spaceId={space.id}
      updateMemoryAction={updateMemory}
      deleteMemoryPhotoAction={deleteMemoryPhoto}
      deleteMemoryAction={deleteMemory}
    />
  );
}
