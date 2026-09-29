import Link from "next/link";

import JournalForm from "@/features/journal/components/JournalForm";
import { createJournalEntry } from "@/features/journal/actions";

export default function NewJournalPage() {
  return (
    <section className="mx-auto max-w-3xl">
      <Link href="/journal" className="text-sm text-[var(--muted)]">
        ← Journal
      </Link>

      <div className="mt-6">
        <p className="text-sm text-[var(--muted)]">Write something down</p>

        <h1 className="mt-1 text-3xl font-semibold">New entry</h1>
      </div>

      <div className="mt-8">
        <JournalForm action={createJournalEntry} submitLabel="Save entry" />
      </div>
    </section>
  );
}
