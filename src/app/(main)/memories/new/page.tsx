import Link from "next/link";

import Button from "@/components/ui/Button";

import { createMemory } from "./actions";

export default function NewMemoryPage() {
  return (
    <section className="mx-auto max-w-2xl">
      <Link href="/memories" className="text-sm text-neutral-500">
        ← Memories
      </Link>

      <h1 className="mt-6 text-3xl font-semibold">New memory</h1>

      <form action={createMemory} className="mt-8 space-y-5">
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium">
            Title
          </label>

          <input
            id="title"
            name="title"
            required
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2"
          />
        </div>

        <div>
          <label
            htmlFor="memoryDate"
            className="mb-1 block text-sm font-medium"
          >
            Date
          </label>

          <input
            id="memoryDate"
            name="memoryDate"
            type="date"
            required
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2"
          />
        </div>

        <div>
          <label
            htmlFor="locationName"
            className="mb-1 block text-sm font-medium"
          >
            Location
          </label>

          <input
            id="locationName"
            name="locationName"
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="body" className="mb-1 block text-sm font-medium">
            Story
          </label>

          <textarea
            id="body"
            name="body"
            rows={8}
            className="w-full resize-y rounded-xl border border-neutral-200 bg-white px-3 py-2"
          />
        </div>

        <Button type="submit">Create memory</Button>
      </form>
    </section>
  );
}
