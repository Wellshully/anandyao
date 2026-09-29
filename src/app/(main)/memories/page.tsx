import Link from "next/link";

import { requireSpace } from "@/lib/space/require-space";
import { createClient } from "@/lib/supabase/server";

export default async function MemoriesPage() {
  const space = await requireSpace();

  const supabase = await createClient();

  const { data: memories, error } = await supabase
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
    .eq("space_id", space.id)
    .order("memory_date", { ascending: false });

  if (error) {
    throw error;
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--muted)]">Our story</p>

          <h1 className="mt-1 text-3xl font-semibold">Memories</h1>
        </div>

        <Link
          href="/memories/new"
          className="rounded-xl bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--on-foreground)]"
        >
          New memory
        </Link>
      </div>

      {memories.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-[var(--border)] p-10 text-center">
          <p className="text-[var(--muted)]">No memories yet.</p>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {memories.map((memory) => (
            <Link
              key={memory.id}
              href={`/memories/${memory.id}`}
              className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:-translate-y-0.5 hover:shadow-sm"
            >
              <p className="text-sm text-[var(--muted)]">{memory.memory_date}</p>

              <h2 className="mt-1 text-xl font-medium">{memory.title}</h2>

              {memory.location_name && (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {memory.location_name}
                </p>
              )}

              {memory.body && (
                <p className="mt-3 line-clamp-2 text-sm text-[var(--muted)]">
                  {memory.body}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
