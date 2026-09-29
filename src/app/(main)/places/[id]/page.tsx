import Link from "next/link";
import { notFound } from "next/navigation";

import PlaceForm from "@/features/places/components/PlaceForm";
import { deletePlace, updatePlace } from "@/features/places/actions";
import {
  getPlaceStatusLabel,
  type PlaceStatus,
} from "@/features/places/config/place-status";
import { requireSpace } from "@/lib/space/require-space";
import { createClient } from "@/lib/supabase/server";

type PlacePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PlacePage({ params }: PlacePageProps) {
  const { id } = await params;

  const space = await requireSpace();

  const supabase = await createClient();

  const { data: place, error } = await supabase
    .from("places")
    .select(
      `
        id,
        name,
        status,
        note,
        address,
        visited_on
      `,
    )
    .eq("id", id)
    .eq("space_id", space.id)
    .maybeSingle();

  if (error || !place) {
    notFound();
  }

  const status = place.status as PlaceStatus;

  return (
    <section className="mx-auto max-w-2xl">
      <Link href="/places" className="text-sm text-[var(--muted)]">
        ← Places
      </Link>

      <div className="mt-6">
        <p className="text-sm text-[var(--muted)]">
          {getPlaceStatusLabel(status)}
        </p>

        <h1 className="mt-1 text-3xl font-semibold">{place.name}</h1>

        {place.address && (
          <p className="mt-3 text-[var(--muted)]">{place.address}</p>
        )}

        {place.note && (
          <p className="mt-6 whitespace-pre-wrap leading-7 text-[var(--foreground)]">
            {place.note}
          </p>
        )}

        {place.visited_on && (
          <p className="mt-4 text-sm text-[var(--muted)]">
            Visited: {place.visited_on}
          </p>
        )}
      </div>

      <div className="mt-12 border-t border-[var(--border)] pt-8">
        <h2 className="text-xl font-medium">Edit place</h2>

        <div className="mt-5">
          <PlaceForm
            action={updatePlace}
            submitLabel="Save changes"
            place={{
              ...place,
              status,
            }}
          />
        </div>
      </div>

      <div className="mt-12 border-t border-[var(--border)] pt-8">
        <form action={deletePlace}>
          <input type="hidden" name="placeId" value={place.id} />

          <button type="submit" className="text-sm text-[var(--danger)]">
            Delete place
          </button>
        </form>
      </div>
    </section>
  );
}
