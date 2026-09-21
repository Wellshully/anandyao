import Link from "next/link";

import PlaceForm from "@/features/places/components/PlaceForm";
import { createPlace } from "@/features/places/actions";

export default function NewPlacePage() {
  return (
    <section className="mx-auto max-w-2xl">
      <Link href="/places" className="text-sm text-neutral-500">
        ← Places
      </Link>

      <div className="mt-6">
        <p className="text-sm text-neutral-500">Somewhere for us</p>

        <h1 className="mt-1 text-3xl font-semibold">New place</h1>
      </div>

      <div className="mt-8">
        <PlaceForm action={createPlace} submitLabel="Add place" />
      </div>
    </section>
  );
}
