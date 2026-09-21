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
          <p className="text-sm text-neutral-500">Our story</p>

          <h1 className="mt-1 text-3xl font-semibold">Memories</h1>
        </div>

        <Link
          href="/memories/new"
          className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-medium text-white"
        >
          New memory
        </Link>
      </div>

      {memories.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-neutral-300 p-10 text-center">
          <p className="text-neutral-500">No memories yet.</p>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {memories.map((memory) => (
            <Link
              key={memory.id}
              href={`/memories/${memory.id}`}
              className="block rounded-2xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-sm"
            >
              <p className="text-sm text-neutral-500">{memory.memory_date}</p>

              <h2 className="mt-1 text-xl font-medium">{memory.title}</h2>

              {memory.location_name && (
                <p className="mt-2 text-sm text-neutral-500">
                  {memory.location_name}
                </p>
              )}

              {memory.body && (
                <p className="mt-3 line-clamp-2 text-sm text-neutral-600">
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
