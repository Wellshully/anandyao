import "server-only";

import { createClient } from "@/lib/supabase/server";

import { getNtuMailByUidl } from "@/features/study/mail/ntu-webmail-client";

import { sanitizeStudyHtml } from "@/features/study/lib/sanitize-study-html";

export type StudyMailAttachment = {
  filename: string;

  mimeType: string;
};

export type StudyMailDetail = {
  id: string;

  subject: string;

  fromName: string | null;

  fromAddress: string | null;

  sentAt: string | null;

  html: string;

  text: string;

  attachments: StudyMailAttachment[];

  detailAvailable: boolean;

  unavailableReason: "not_on_server" | "mail_unavailable" | null;
};

export async function getStudyMailDetail(
  id: string,
): Promise<StudyMailDetail | null> {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("Not authenticated.");
  }

  const { data, error } = await supabase
    .from("study_mail_messages")
    .select(
      `
          id,
          uidl,
          subject,
          from_name,
          from_address,
          sent_at,
          seen_at
        `,
    )
    .eq("id", id)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  try {
    const mail = await getNtuMailByUidl(data.uidl);

    if (!mail) {
      return {
        id: data.id,

        subject: data.subject,

        fromName: data.from_name,

        fromAddress: data.from_address,

        sentAt: data.sent_at,

        html: "",

        text: "",

        attachments: [],

        detailAvailable: false,

        unavailableReason: "not_on_server",
      };
    }

    /*
     * Opening a mail inside An & Yao means
     * it has been seen inside our app.
     *
     * This does NOT modify NTU WebMail.
     */
    if (!data.seen_at) {
      const { error: seenError } = await supabase
        .from("study_mail_messages")
        .update({
          seen_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .eq("user_id", authData.user.id)
        .is("seen_at", null);

      if (seenError) {
        console.warn("Failed to mark Study mail as seen:", seenError.message);
      }
    }

    const attachments = (mail.attachments ?? [])
      .filter((attachment) => Boolean(attachment.filename))
      .map((attachment) => ({
        filename: attachment.filename ?? "附件",

        mimeType: attachment.mimeType,
      }));

    return {
      id: data.id,

      subject: mail.subject?.trim() || data.subject,

      fromName: data.from_name,

      fromAddress: data.from_address,

      sentAt: mail.date ?? data.sent_at,

      html: sanitizeStudyHtml(mail.html),

      text: mail.text?.trim() ?? "",

      attachments,

      detailAvailable: true,

      unavailableReason: null,
    };
  } catch (cause) {
    console.warn(
      "Unable to retrieve NTU mail:",
      cause instanceof Error ? cause.message : cause,
    );

    return {
      id: data.id,

      subject: data.subject,

      fromName: data.from_name,

      fromAddress: data.from_address,

      sentAt: data.sent_at,

      html: "",

      text: "",

      attachments: [],

      detailAvailable: false,

      unavailableReason: "mail_unavailable",
    };
  }
}
