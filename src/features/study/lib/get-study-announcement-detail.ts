import "server-only";

import { createClient } from "@/lib/supabase/server";

import {
  getNtuCoolAnnouncement,
  isNtuCoolAuthError,
} from "@/features/study/lib/ntu-cool-client";

import { sanitizeStudyHtml } from "@/features/study/lib/sanitize-study-html";

export async function getStudyAnnouncementDetail(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("study_announcements")
    .select(
      `
          id,
          cool_course_id,
          cool_announcement_id,
          course_name,
          title,
          posted_at,
          read_state,
          seen_at,
          html_url
        `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  try {
    const announcement = await getNtuCoolAnnouncement(
      Number(data.cool_course_id),

      Number(data.cool_announcement_id),
    );

    /*
     * Only mark it seen when we actually
     * managed to retrieve the full content.
     */
    let seenAt = data.seen_at;

    if (!seenAt) {
      seenAt = new Date().toISOString();

      const { error: seenError } = await supabase
        .from("study_announcements")
        .update({
          seen_at: seenAt,
        })
        .eq("id", data.id)
        .is("seen_at", null);

      if (seenError) {
        console.warn("Failed to mark announcement as seen:", seenError.message);
      }
    }

    return {
      id: data.id,

      courseName: data.course_name ?? "Unknown course",

      title: announcement.title ?? data.title,

      postedAt: announcement.posted_at ?? data.posted_at,

      readState: data.read_state,

      seenAt,

      messageHtml: sanitizeStudyHtml(announcement.message),

      htmlUrl: announcement.html_url ?? data.html_url,

      detailAvailable: true,

      unavailableReason: null,
    };
  } catch (cause) {
    return {
      id: data.id,

      courseName: data.course_name ?? "Unknown course",

      title: data.title,

      postedAt: data.posted_at,

      readState: data.read_state,

      seenAt: data.seen_at,

      messageHtml: "",

      htmlUrl: data.html_url,

      detailAvailable: false,

      unavailableReason: isNtuCoolAuthError(cause)
        ? "auth_expired"
        : "cool_unavailable",
    };
  }
}
