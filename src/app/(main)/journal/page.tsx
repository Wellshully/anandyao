import Link from "next/link";

import { requireUser } from "@/lib/auth/require-user";
import { requireSpace } from "@/lib/space/require-space";
import { createClient } from "@/lib/supabase/server";

export default async function JournalPage() {
  const user = await requireUser();

  const space = await requireSpace();

  const supabase = await createClient();

  const { data: entries, error } = await supabase
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
    .eq("space_id", space.id)
    .order("entry_date", { ascending: false });

  if (error) {
    throw error;
  }

  const drafts = entries.filter(
    (entry) => entry.status === "draft" && entry.author_id === user.id,
  );

  const published = entries.filter((entry) => entry.status === "published");

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Things worth remembering</p>

          <h1 className="mt-1 text-3xl font-semibold">Journal</h1>
        </div>

        <Link
          href="/journal/new"
          className="rounded-xl bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-white"
        >
          New entry
        </Link>
      </div>

      {drafts.length > 0 && (
        <section className="mt-10">
          <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-medium">Drafts</h2>

            <span className="text-sm text-neutral-400">{drafts.length}</span>
          </div>

          <div className="mt-4 space-y-3">
            {drafts.map((entry) => (
              <Link
                key={entry.id}
                href={`/journal/${entry.id}`}
                className="block rounded-2xl border border-dashed border-neutral-300 bg-white p-5"
              >
                <p className="text-xs text-neutral-400">
                  Draft · {entry.entry_date}
                </p>

                <h3 className="mt-1 text-lg font-medium">{entry.title}</h3>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-baseline gap-2">
          <h2 className="text-xl font-medium">Published</h2>

          <span className="text-sm text-neutral-400">{published.length}</span>
        </div>

        {published.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 p-10 text-center">
            <p className="text-neutral-500">No published entries yet.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {published.map((entry) => (
              <Link
                key={entry.id}
                href={`/journal/${entry.id}`}
                className="block rounded-2xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-sm"
              >
                <p className="text-sm text-neutral-500">{entry.entry_date}</p>

                <h3 className="mt-1 text-xl font-medium">{entry.title}</h3>

                <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-neutral-600">
                  {entry.content}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
