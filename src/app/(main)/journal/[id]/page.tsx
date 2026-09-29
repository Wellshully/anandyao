import Link from "next/link";
import { notFound } from "next/navigation";

import JournalForm from "@/features/journal/components/JournalForm";
import MarkdownContent from "@/features/journal/components/MarkdownContent";
import {
  deleteJournalEntry,
  updateJournalEntry,
} from "@/features/journal/actions";
import { type JournalStatus } from "@/features/journal/config/journal-status";
import { requireUser } from "@/lib/auth/require-user";
import { requireSpace } from "@/lib/space/require-space";
import { createClient } from "@/lib/supabase/server";

type JournalEntryPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function JournalEntryPage({
  params,
}: JournalEntryPageProps) {
  const { id } = await params;

  const user = await requireUser();

  const space = await requireSpace();

  const supabase = await createClient();

  const { data: entry, error } = await supabase
    .from("journal_entries")
    .select(
      `
      id,
      author_id,
      title,
      content,
      entry_date,
      status,
      published_at
    `,
    )
    .eq("id", id)
    .eq("space_id", space.id)
    .maybeSingle();

  if (error || !entry) {
    notFound();
  }
  const author = entry.author_id
    ? (
        await supabase
          .from("profiles")
          .select(
            `
              display_name
            `,
          )
          .eq("id", entry.author_id)
          .maybeSingle()
      ).data
    : null;
  const isAuthor = entry.author_id === user.id;

  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/journal" className="text-sm text-[var(--muted)]">
        ← Journal
      </Link>

      <header className="mt-8">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
          <span>{entry.entry_date}</span>

          <span>·</span>

          <span>{author?.display_name ?? "Member"}</span>

          {entry.status === "draft" && (
            <>
              <span>·</span>

              <span>Draft</span>
            </>
          )}
        </div>

        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          {entry.title}
        </h1>
      </header>

      <div className="mt-10">
        <MarkdownContent content={entry.content} />
      </div>

      {isAuthor && (
        <>
          <section className="mt-16 border-t border-[var(--border)] pt-8">
            <h2 className="text-xl font-medium">Edit entry</h2>

            <div className="mt-5">
              <JournalForm
                action={updateJournalEntry}
                submitLabel="Save changes"
                entry={{
                  id: entry.id,
                  title: entry.title,
                  content: entry.content,
                  entry_date: entry.entry_date,

                  status: entry.status as JournalStatus,
                }}
              />
            </div>
          </section>

          <section className="mt-12 border-t border-[var(--border)] pt-8">
            <form action={deleteJournalEntry}>
              <input type="hidden" name="entryId" value={entry.id} />

              <button type="submit" className="text-sm text-[var(--danger)]">
                Delete entry
              </button>
            </form>
          </section>
        </>
      )}
    </article>
  );
}
