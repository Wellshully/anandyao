"use client";

import Image from "next/image";
import Link from "next/link";

import { useState } from "react";

import { useFormStatus } from "react-dom";

import PhotoUploader from "@/features/memories/components/PhotoUploader";

type Memory = {
  id: string;
  title: string;
  body: string | null;
  memory_date: string;
  location_name: string | null;
};

type MemoryPhoto = {
  id: string;
  signedUrl: string;
  altText: string | null;
};

type ServerFormAction = (formData: FormData) => void | Promise<void>;

type MemoryDetailProps = {
  memory: Memory;

  photos: MemoryPhoto[];

  spaceId: string;

  updateMemoryAction: ServerFormAction;

  deleteMemoryPhotoAction: ServerFormAction;

  deleteMemoryAction: ServerFormAction;
};

const dateFormatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",

  year: "numeric",

  month: "long",

  day: "numeric",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00+08:00`));
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      form="memory-edit-form"
      disabled={pending}
      className="
        rounded-xl
        bg-[var(--foreground)]
        px-5
        py-3
        text-sm
        font-medium
        text-white
        disabled:opacity-50
      "
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}
export default function MemoryDetail({
  memory,
  photos,
  spaceId,
  updateMemoryAction,
  deleteMemoryPhotoAction,
  deleteMemoryAction,
}: MemoryDetailProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <section className="mx-auto w-full max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <Link href="/memories" className="text-sm text-[var(--muted)]">
          ← Memories
        </Link>

        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="
              rounded-xl
              border
              border-[var(--border)]
              px-4
              py-2
              text-sm
              transition
              hover:border-[var(--foreground)]
            "
          >
            Edit
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="
              rounded-xl
              border
              border-[var(--border)]
              px-4
              py-2
              text-sm
              text-[var(--muted)]
              transition
              hover:border-[var(--foreground)]
              hover:text-[var(--foreground)]
            "
          >
            Cancel
          </button>
        )}
      </div>

      {!isEditing ? (
        /*
         * =========================
         * Read mode
         * =========================
         */
        <div className="mt-8">
          <header>
            <p className="text-sm text-[var(--muted)]">
              {formatDate(memory.memory_date)}
            </p>

            <h1 className="font-story mt-2 text-4xl font-semibold sm:text-5xl">
              {memory.title}
            </h1>

            {memory.location_name && (
              <p className="mt-3 text-sm text-[var(--muted)]">
                {memory.location_name}
              </p>
            )}
          </header>

          {memory.body && (
            <p
              className="
                mt-8
                whitespace-pre-wrap
                text-base
                leading-8
                text-[var(--foreground)]
              "
            >
              {memory.body}
            </p>
          )}

          {photos.length > 0 && (
            <div
              className="
                mt-10
                grid
                grid-cols-2
                gap-2
                sm:gap-3
              "
            >
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  className={`
                      relative
                      overflow-hidden
                      rounded-[var(--radius-md)]
                      bg-[var(--surface-soft)]

                      ${
                        photos.length > 2 && index === 0
                          ? "col-span-2 aspect-[16/10]"
                          : "aspect-square"
                      }
                    `}
                >
                  <Image
                    src={photo.signedUrl}
                    alt={photo.altText ?? memory.title}
                    fill
                    sizes={
                      index === 0
                        ? "(max-width: 768px) 100vw, 768px"
                        : "(max-width: 640px) 50vw, 380px"
                    }
                    loading={index === 0 ? "eager" : "lazy"}
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /*
         * =========================
         * Edit mode
         * =========================
         */
        <div className="mt-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
            Edit memory
          </p>

          {/*
           * IMPORTANT:
           *
           * Call the original Server Action directly.
           *
           * Do not wrap this in try/catch because
           * Next.js redirect() works by throwing a
           * special internal redirect signal.
           */}
          <form
            id="memory-edit-form"
            action={updateMemoryAction}
            className="mt-6 space-y-5"
          >
            <input type="hidden" name="memoryId" value={memory.id} />

            <div>
              <label
                htmlFor="memory-title"
                className="mb-1.5 block text-xs text-[var(--muted)]"
              >
                Title
              </label>

              <input
                id="memory-title"
                name="title"
                defaultValue={memory.title}
                required
                className="
                  w-full
                  rounded-xl
                  border
                  border-[var(--border)]
                  bg-[var(--surface)]
                  px-4
                  py-3
                  outline-none
                  transition
                  focus:border-[var(--accent)]
                "
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="memory-date"
                  className="mb-1.5 block text-xs text-[var(--muted)]"
                >
                  Date
                </label>

                <input
                  id="memory-date"
                  name="memoryDate"
                  type="date"
                  defaultValue={memory.memory_date}
                  required
                  className="
                    w-full
                    rounded-xl
                    border
                    border-[var(--border)]
                    bg-[var(--surface)]
                    px-4
                    py-3
                    outline-none
                    transition
                    focus:border-[var(--accent)]
                  "
                />
              </div>

              <div>
                <label
                  htmlFor="memory-location"
                  className="mb-1.5 block text-xs text-[var(--muted)]"
                >
                  Location
                </label>

                <input
                  id="memory-location"
                  name="locationName"
                  defaultValue={memory.location_name ?? ""}
                  className="
                    w-full
                    rounded-xl
                    border
                    border-[var(--border)]
                    bg-[var(--surface)]
                    px-4
                    py-3
                    outline-none
                    transition
                    focus:border-[var(--accent)]
                  "
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="memory-body"
                className="mb-1.5 block text-xs text-[var(--muted)]"
              >
                Story
              </label>

              <textarea
                id="memory-body"
                name="body"
                rows={7}
                defaultValue={memory.body ?? ""}
                className="
                  w-full
                  resize-none
                  rounded-xl
                  border
                  border-[var(--border)]
                  bg-[var(--surface)]
                  px-4
                  py-3
                  leading-7
                  outline-none
                  transition
                  focus:border-[var(--accent)]
                "
              />
            </div>
          </form>

          <section className="mt-10 border-t border-[var(--border)] pt-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-story text-2xl font-semibold">Photos</h2>

              <p className="text-xs text-[var(--muted)]">
                {photos.length} photos
              </p>
            </div>

            {photos.length > 0 && (
              <div
                className="
                  mt-5
                  grid
                  grid-cols-2
                  gap-3
                  sm:grid-cols-3
                "
              >
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="
                        relative
                        aspect-square
                        overflow-hidden
                        rounded-[var(--radius-md)]
                        bg-[var(--surface-soft)]
                      "
                  >
                    <Image
                      src={photo.signedUrl}
                      alt={photo.altText ?? memory.title}
                      fill
                      sizes="(max-width: 640px) 50vw, 240px"
                      className="object-cover"
                    />

                    {/*
                     * Same idea here:
                     * use the original Server Action
                     * directly.
                     */}
                    <form
                      action={deleteMemoryPhotoAction}
                      onSubmit={(event) => {
                        const confirmed =
                          window.confirm("確定要移除這張照片嗎？");

                        if (!confirmed) {
                          event.preventDefault();
                        }
                      }}
                      className="
                          absolute
                          right-2
                          top-2
                          z-10
                        "
                    >
                      <input type="hidden" name="memoryId" value={memory.id} />

                      <input type="hidden" name="mediaId" value={photo.id} />

                      <button
                        type="submit"
                        aria-label="Remove photo"
                        className="
                            flex
                            h-8
                            w-8
                            items-center
                            justify-center
                            rounded-full
                            bg-black/55
                            text-base
                            leading-none
                            text-white
                            backdrop-blur-sm
                            transition
                            hover:bg-black/75
                          "
                      >
                        ×
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5">
              <PhotoUploader
                memoryId={memory.id}
                spaceId={spaceId}
                currentCount={photos.length}
              />
            </div>
            <div className="mt-8">
              <SaveButton />
            </div>
          </section>

          <section className="mt-10 border-t border-[var(--border)] pt-6">
            <form
              action={deleteMemoryAction}
              onSubmit={(event) => {
                const confirmed = window.confirm(
                  "確定要永久刪除這個 Memory 嗎？這個動作無法復原。",
                );

                if (!confirmed) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="memoryId" value={memory.id} />

              <button
                type="submit"
                className="
                  text-xs
                  text-[var(--muted)]
                  transition
                  hover:text-[var(--danger)]
                "
              >
                Delete memory
              </button>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
