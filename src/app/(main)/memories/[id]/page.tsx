import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import Button from "@/components/ui/Button";
import PhotoUploader from "@/features/memories/components/PhotoUploader";
import { requireSpace } from "@/lib/space/require-space";
import { createClient } from "@/lib/supabase/server";

import { deleteMemory, deleteMemoryPhoto, updateMemory } from "./actions";

type MemoryPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function MemoryPage({ params }: MemoryPageProps) {
  const { id } = await params;

  const space = await requireSpace();

  const supabase = await createClient();

  const { data: memory, error: memoryError } = await supabase
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
    .eq("id", id)
    .eq("space_id", space.id)
    .maybeSingle();

  if (memoryError || !memory) {
    notFound();
  }

  const { data: links, error: linksError } = await supabase
    .from("memory_media")
    .select(
      `
      media_id,
      sort_order,
      caption
    `,
    )
    .eq("memory_id", memory.id)
    .order("sort_order", { ascending: true });

  if (linksError) {
    throw linksError;
  }

  const mediaIds = links.map((item) => item.media_id);

  const { data: mediaRows } =
    mediaIds.length > 0
      ? await supabase
          .from("media")
          .select(
            `
            id,
            storage_path,
            file_name,
            alt_text,
            width,
            height
          `,
          )
          .in("id", mediaIds)
      : { data: [] };

  const mediaMap = new Map(mediaRows?.map((media) => [media.id, media]) ?? []);

  const orderedMedia = links
    .map((link) => {
      const media = mediaMap.get(link.media_id);

      if (!media) {
        return null;
      }

      return {
        ...media,
        sortOrder: link.sort_order,
        caption: link.caption,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const paths = orderedMedia.map((item) => item.storage_path);

  const { data: signedUrls } =
    paths.length > 0
      ? await supabase.storage.from("media").createSignedUrls(paths, 60 * 60)
      : { data: [] };

  const signedUrlMap = new Map(
    signedUrls?.map((item) => [item.path, item.signedUrl]) ?? [],
  );

  return (
    <section className="mx-auto max-w-3xl">
      <Link href="/memories" className="text-sm text-neutral-500">
        ← Memories
      </Link>

      <div className="mt-6">
        <p className="text-sm text-neutral-500">{memory.memory_date}</p>

        <h1 className="mt-1 text-3xl font-semibold">{memory.title}</h1>

        {memory.location_name && (
          <p className="mt-2 text-sm text-neutral-500">
            {memory.location_name}
          </p>
        )}
      </div>

      {memory.body && (
        <p className="mt-6 whitespace-pre-wrap leading-7 text-neutral-700">
          {memory.body}
        </p>
      )}

      <div className="mt-10">
        <h2 className="text-xl font-medium">Photos</h2>

        {orderedMedia.length > 0 && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {orderedMedia.map((media) => {
              const signedUrl = signedUrlMap.get(media.storage_path);

              if (!signedUrl) {
                return null;
              }

              return (
                <div
                  key={media.id}
                  className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                >
                  <div className="relative aspect-[4/3]">
                    <Image
                      src={signedUrl}
                      alt={media.alt_text ?? memory.title}
                      fill
                      sizes="(max-width: 640px) 100vw, 50vw"
                      className="object-cover"
                    />
                  </div>

                  <form action={deleteMemoryPhoto} className="p-3">
                    <input type="hidden" name="memoryId" value={memory.id} />

                    <input type="hidden" name="mediaId" value={media.id} />

                    <button
                      type="submit"
                      className="text-xs text-neutral-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4">
          <PhotoUploader
            memoryId={memory.id}
            spaceId={space.id}
            currentCount={orderedMedia.length}
          />
        </div>
      </div>

      <div className="mt-12 border-t border-neutral-200 pt-8">
        <h2 className="text-xl font-medium">Edit memory</h2>

        <form action={updateMemory} className="mt-5 space-y-4">
          <input type="hidden" name="memoryId" value={memory.id} />

          <div>
            <label className="mb-1 block text-sm font-medium">Title</label>

            <input
              name="title"
              defaultValue={memory.title}
              required
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Date</label>

            <input
              name="memoryDate"
              type="date"
              defaultValue={memory.memory_date}
              required
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Location</label>

            <input
              name="locationName"
              defaultValue={memory.location_name ?? ""}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Story</label>

            <textarea
              name="body"
              rows={8}
              defaultValue={memory.body ?? ""}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2"
            />
          </div>

          <Button type="submit">Save changes</Button>
        </form>
      </div>

      <div className="mt-12 border-t border-neutral-200 pt-8">
        <form action={deleteMemory}>
          <input type="hidden" name="memoryId" value={memory.id} />

          <button type="submit" className="text-sm text-red-600">
            Delete memory
          </button>
        </form>
      </div>
    </section>
  );
}
