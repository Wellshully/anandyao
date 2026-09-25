import "server-only";

import { createClient } from "@/lib/supabase/server";
import { shouldIgnoreNtuMail } from "@/features/study/mail/mail-filter";
export type StudyMailListItem = {
  id: string;

  subject: string;

  fromName: string | null;

  fromAddress: string | null;

  sentAt: string | null;

  seenAt: string | null;
};

export async function getStudyMailList(): Promise<StudyMailListItem[]> {
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
          subject,
          from_name,
          from_address,
          sent_at,
          seen_at
        `,
    )
    .eq("user_id", authData.user.id)
    .order("sent_at", {
      ascending: false,
    })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? [])
    .filter((mail) => !shouldIgnoreNtuMail(mail.subject))
    .map((mail) => ({
      id: mail.id,

      subject: mail.subject,

      fromName: mail.from_name,

      fromAddress: mail.from_address,

      sentAt: mail.sent_at,

      seenAt: mail.seen_at,
    }));
}
