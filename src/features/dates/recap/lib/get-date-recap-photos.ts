import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { DateRecapPhoto } from "@/features/dates/recap/photo-types";

export async function getDateRecapPhotos(
  recapId: string,
): Promise<DateRecapPhoto[]> {
  const supabase = await createClient();

  const { data: links, error: linksError } = await supabase
    .from("date_recap_media")
    .select(
      `
        media_id,
        sort_order
      `,
    )
    .eq("recap_id", recapId)
    .order("sort_order", {
      ascending: true,
    });

  if (linksError) {
    throw new Error(linksError.message);
  }

  if (!links || links.length === 0) {
    return [];
  }

  const mediaIds = links.map((link) => link.media_id);

  const { data: mediaRows, error: mediaError } = await supabase
    .from("media")
    .select(
      `
        id,
        storage_path,
        file_name,
        width,
        height
      `,
    )
    .in("id", mediaIds);

  if (mediaError) {
    throw new Error(mediaError.message);
  }

  const mediaById = new Map(
    (mediaRows ?? []).map((media) => [media.id, media]),
  );

  const ordered = links
    .map((link) => {
      const media = mediaById.get(link.media_id);

      if (!media) {
        return null;
      }

      return {
        media,
        sortOrder: link.sort_order,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const paths = ordered.map((item) => item.media.storage_path);

  const { data: signed, error: signedError } = await supabase.storage
    .from("media")
    .createSignedUrls(paths, 60 * 60);

  if (signedError) {
    throw new Error(signedError.message);
  }

  return ordered.map((item, index) => ({
    mediaId: item.media.id,

    storagePath: item.media.storage_path,

    fileName: item.media.file_name,

    width: item.media.width,

    height: item.media.height,

    sortOrder: item.sortOrder,

    signedUrl: signed?.[index]?.signedUrl ?? "",
  }));
}
