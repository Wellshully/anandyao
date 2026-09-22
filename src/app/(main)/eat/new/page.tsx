import Link from "next/link";

import AddRestaurantForm from "@/features/eat/components/AddRestaurantForm";

export default function NewRestaurantPage() {
  return (
    <div className="mx-auto max-w-2xl py-4 sm:py-10">
      <Link href="/eat" className="text-sm text-[var(--muted)]">
        ← Eat
      </Link>

      <div className="mt-8">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--accent)]">
          New restaurant
        </p>

        <h1 className="font-story mt-3 text-4xl font-semibold">加一間餐廳</h1>

        <p className="mt-4 leading-7 text-[var(--muted)]">
          不一定要是台大附近。 只要是之後可能會想再吃的，都可以放進來。
        </p>
      </div>

      <div className="mt-10">
        <AddRestaurantForm />
      </div>
    </div>
  );
}
