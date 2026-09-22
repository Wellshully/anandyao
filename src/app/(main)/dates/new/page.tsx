import Link from "next/link";

import CreateDateForm from "@/features/dates/components/CreateDateForm";

export default function NewDatePage() {
  return (
    <div className="mx-auto max-w-2xl py-4 sm:py-10">
      <Link href="/dates" className="text-sm text-[var(--muted)]">
        ← Dates
      </Link>

      <div className="mt-8">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--accent)]">
          New date
        </p>

        <h1 className="font-story mt-3 text-4xl font-semibold">約她出去</h1>

        <p className="mt-4 leading-7 text-[var(--muted)]">
          可以只是一頓飯， 也可以是一次還沒開始的小旅行。
        </p>
      </div>

      <div className="mt-10">
        <CreateDateForm />
      </div>
    </div>
  );
}
