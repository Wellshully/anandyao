import Link from "next/link";

import { notFound } from "next/navigation";

import EditRestaurantForm from "@/features/eat/components/EditRestaurantForm";

import { getRestaurant } from "@/features/eat/lib/get-restaurant";

type EditRestaurantPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditRestaurantPage({
  params,
}: EditRestaurantPageProps) {
  const { id } = await params;

  const details = await getRestaurant(id);

  if (!details) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl py-4 sm:py-10">
      <Link href={`/eat/${id}`} className="text-sm text-[var(--muted)]">
        ← {details.restaurant.name}
      </Link>

      <div className="mt-8">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--accent)]">
          Edit restaurant
        </p>

        <h1 className="font-story mt-3 text-4xl font-semibold">編輯餐廳</h1>
      </div>

      <div className="mt-10">
        <EditRestaurantForm restaurant={details.restaurant} />
      </div>
    </div>
  );
}
