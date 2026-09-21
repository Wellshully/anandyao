import Link from "next/link";

import { PLACE_STATUSES } from "@/features/places/config/place-status";
import { requireSpace } from "@/lib/space/require-space";
import { createClient } from "@/lib/supabase/server";

export default async function PlacesPage() {
  const space = await requireSpace();

  const supabase = await createClient();

  const { data: places, error } = await supabase
    .from("places")
    .select(
      `
        id,
        name,
        status,
        note,
        address,
        visited_on,
        created_at
      `,
    )
    .eq("space_id", space.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Somewhere together</p>

          <h1 className="mt-1 text-3xl font-semibold">Places</h1>
        </div>

        <Link
          href="/places/new"
          className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-medium text-white"
        >
          New place
        </Link>
      </div>

      {places.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-neutral-300 p-10 text-center">
          <p className="text-neutral-500">No places yet.</p>
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          {PLACE_STATUSES.map((status) => {
            const items = places.filter(
              (place) => place.status === status.value,
            );

            return (
              <section key={status.value}>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-xl font-medium">{status.label}</h2>

                  <span className="text-sm text-neutral-400">
                    {items.length}
                  </span>
                </div>

                {items.length === 0 ? (
                  <p className="mt-3 text-sm text-neutral-400">
                    Nothing here yet.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {items.map((place) => (
                      <Link
                        key={place.id}
                        href={`/places/${place.id}`}
                        className="rounded-2xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-sm"
                      >
                        <h3 className="text-lg font-medium">{place.name}</h3>

                        {place.address && (
                          <p className="mt-2 text-sm text-neutral-500">
                            {place.address}
                          </p>
                        )}

                        {place.visited_on && (
                          <p className="mt-2 text-xs text-neutral-400">
                            {place.visited_on}
                          </p>
                        )}

                        {place.note && (
                          <p className="mt-3 line-clamp-2 text-sm text-neutral-600">
                            {place.note}
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
