import "server-only";

import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { requireSpace } from "@/lib/space/require-space";
import { createClient } from "@/lib/supabase/server";
import { getTaipeiToday } from "@/lib/time/get-taipei-today";

import {
  getDateRecapWindowState,
} from "@/features/dates/lib/date-recap-window";

import {
  canDeleteDateRecapPhoto,
} from "./can-delete-date-recap-photo";

const inputSchema = z.object({
  recapId: z.string().uuid(),
  mediaId: z.string().uuid(),
}).strict();

export async function deleteDateRecapPhoto(input: {
  recapId: string;
  mediaId: string;
}): Promise<{ dateId: string }> {
  const parsed = inputSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("照片刪除資料無效。");
  }

  const { recapId, mediaId } = parsed.data;

  const [supabase, user, space] = await Promise.all([
    createClient(),
    requireUser(),
    requireSpace(),
  ]);

  const { data: recap, error: recapError } = await supabase
    .from("date_recaps")
    .select("id, date_id, space_id, status")
    .eq("id", recapId)
    .eq("space_id", space.id)
    .maybeSingle();

  if (recapError || !recap) {
    throw new Error("找不到可以編輯的 Date Recap。");
  }

  const [dateResult, participantResult, linkResult, mediaResult] =
    await Promise.all([
      supabase
        .from("dates")
        .select("id, status, end_date, space_id")
        .eq("id", recap.date_id)
        .eq("space_id", space.id)
        .maybeSingle(),

      supabase
        .from("date_participants")
        .select("status")
        .eq("date_id", recap.date_id)
        .eq("user_id", user.id)
        .maybeSingle(),

      supabase
        .from("date_recap_media")
        .select("media_id")
        .eq("recap_id", recapId)
        .eq("media_id", mediaId)
        .maybeSingle(),

      supabase
        .from("media")
        .select("id, space_id, storage_path")
        .eq("id", mediaId)
        .eq("space_id", space.id)
        .maybeSingle(),
    ]);

  if (
    dateResult.error ||
    participantResult.error ||
    linkResult.error ||
    mediaResult.error
  ) {
    throw new Error("無法驗證照片刪除權限。");
  }

  const date = dateResult.data;
  const participant = participantResult.data;
  const link = linkResult.data;
  const media = mediaResult.data;

  if (!date || !link || !media) {
    throw new Error("找不到這張 Recap 照片。");
  }

  const windowState = getDateRecapWindowState({
    endDate: date.end_date,
    today: getTaipeiToday(),
    recapStatus:
      recap.status === "completed" ? "completed" : "draft",
  });

  if (!canDeleteDateRecapPhoto({
    recapStatus: recap.status,
    dateStatus: date.status,
    participantStatus: participant?.status ?? null,
    windowState,
  })) {
    throw new Error("這份 Recap 目前不能刪除照片。");
  }

  // First unlink the exact photo from this editable Recap.
  const { data: deletedLinks, error: deleteError } = await supabase
    .from("date_recap_media")
    .delete()
    .eq("recap_id", recapId)
    .eq("media_id", mediaId)
    .select("media_id");

  if (deleteError || !deletedLinks?.length) {
    throw new Error(
      deleteError?.message ?? "照片未成功刪除。",
    );
  }

  // Clean up the underlying media only if it has
  // no remaining Recap references.
  const { data: remainingLinks, error: remainingError } =
    await supabase
      .from("date_recap_media")
      .select("media_id")
      .eq("media_id", mediaId)
      .limit(1);

  if (remainingError) {
    console.warn(
      "Recap photo reference cleanup check failed:",
      remainingError.message,
    );

    return { dateId: date.id };
  }

  if ((remainingLinks?.length ?? 0) > 0) {
    return { dateId: date.id };
  }

  // Do not delete storage used by an existing Memory.
  const { data: memoryLinks, error: memoryLinksError } =
    await supabase
      .from("memory_media")
      .select("media_id")
      .eq("media_id", mediaId)
      .limit(1);

  if (memoryLinksError) {
    console.warn(
      "Recap photo Memory reference check failed:",
      memoryLinksError.message,
    );

    return { dateId: date.id };
  }

  if ((memoryLinks?.length ?? 0) > 0) {
    return { dateId: date.id };
  }

  const { data: deletedMedia, error: mediaDeleteError } =
    await supabase
      .from("media")
      .delete()
      .eq("id", mediaId)
      .eq("space_id", space.id)
      .select("id");

  if (mediaDeleteError || !deletedMedia?.length) {
    console.warn(
      "Recap photo media cleanup failed:",
      mediaDeleteError?.message ??
        "Media row was not deleted.",
    );

    return { dateId: date.id };
  }

  const { error: storageError } = await supabase.storage
    .from("media")
    .remove([media.storage_path]);

  if (storageError) {
    // The Recap photo was removed successfully,
    // but the orphaned storage object needs cleanup.
    console.warn(
      "Recap photo storage cleanup failed:",
      storageError.message,
    );
  }

  return { dateId: date.id };
}
