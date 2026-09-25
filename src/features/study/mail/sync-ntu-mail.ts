import "server-only";

import { createClient } from "@/lib/supabase/server";

import { getRecentNtuMailHeaders } from "@/features/study/mail/ntu-webmail-client";

import { shouldIgnoreNtuMail } from "@/features/study/mail/mail-filter";

export async function syncNtuMail() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("Not authenticated.");
  }

  const userId = authData.user.id;

  const messages = await getRecentNtuMailHeaders(50);

  const filteredMessages = messages.filter(
    (message) => !shouldIgnoreNtuMail(message.subject),
  );

  /*
   * Remove previously synced
   * "校內訊息" messages.
   */
  const { error: cleanupError } = await supabase
    .from("study_mail_messages")
    .delete()
    .eq("user_id", userId)
    .like("subject", "「校內訊息」%");

  if (cleanupError) {
    throw new Error(cleanupError.message);
  }

  if (filteredMessages.length === 0) {
    return {
      synced: 0,
    };
  }

  const now = new Date().toISOString();

  const rows = filteredMessages.map((message) => ({
    user_id: userId,

    uidl: message.uidl,

    subject: message.subject,

    from_name: message.fromName,

    from_address: message.fromAddress,

    sent_at: message.sentAt,

    message_id_header: message.messageId,

    synced_at: now,
  }));

  /*
   * seen_at is intentionally omitted,
   * so sync will not reset our
   * local read state.
   */
  const { error } = await supabase.from("study_mail_messages").upsert(rows, {
    onConflict: "user_id,uidl",
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    synced: rows.length,
  };
}
