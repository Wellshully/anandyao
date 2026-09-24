"use client";

import type { ReactNode } from "react";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import {
  completeDateRecapAction,
  saveDateRecapAction,
} from "@/features/dates/recap/actions";

import type { DateRecap } from "@/features/dates/recap/types";

type DateRecapFormProps = {
  dateId: string;

  recap: DateRecap;

  hasPhotos: boolean;

  children: ReactNode;
};

export default function DateRecapForm({
  dateId,
  recap,
  hasPhotos,
  children,
}: DateRecapFormProps) {
  const router = useRouter();

  const [favoriteMoment, setFavoriteMoment] = useState(
    recap.favorite_moment ?? "",
  );

  const [message, setMessage] = useState("");

  const [hasError, setHasError] = useState(false);

  const [isSaving, startSaving] = useTransition();

  const [isCompleting, startCompleting] = useTransition();

  function save() {
    if (isSaving || isCompleting) {
      return;
    }

    setHasError(false);

    setMessage("儲存中…");

    startSaving(async () => {
      const result = await saveDateRecapAction({
        recapId: recap.id,

        dateId,

        favoriteMoment,
      });

      if (!result.success) {
        setHasError(true);

        setMessage(result.error);

        return;
      }

      setMessage("已儲存 ✓");
    });
  }

  function handleComplete() {
    const text = favoriteMoment.trim();

    if (!text) {
      setHasError(true);

      setMessage("先寫幾句這次想留下的回憶。");

      return;
    }

    if (!hasPhotos) {
      setHasError(true);

      setMessage("至少選一張照片再完成回顧。");

      return;
    }

    const confirmed = window.confirm(
      "完成後會把這次 Date 存進 Memories，確定要完成嗎？",
    );

    if (!confirmed) {
      return;
    }

    setHasError(false);

    setMessage("正在完成回顧…");

    startCompleting(async () => {
      /*
       * Always save the newest text first.
       * This avoids depending on onBlur timing.
       */
      const saveResult = await saveDateRecapAction({
        recapId: recap.id,

        dateId,

        favoriteMoment: text,
      });

      if (!saveResult.success) {
        setHasError(true);

        setMessage(saveResult.error);

        return;
      }

      const result = await completeDateRecapAction(dateId);

      if (!result.success) {
        setHasError(true);

        setMessage(result.error);

        return;
      }

      router.push(`/memories/${result.memoryId}`);

      router.refresh();
    });
  }

  return (
    <div>
      <section>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
          About this Date
        </p>

        <label
          htmlFor="favoriteMoment"
          className="font-story mt-2 block text-2xl font-semibold"
        >
          這次想記住什麼？
        </label>

        <p className="mt-2 text-sm text-[var(--muted)]">隨便寫幾句就好。</p>

        <textarea
          id="favoriteMoment"
          value={favoriteMoment}
          onChange={(event) => {
            setFavoriteMoment(event.target.value);

            setMessage("尚未儲存");

            setHasError(false);
          }}
          onBlur={save}
          placeholder="今天發生了什麼..."
          rows={8}
          className="
            mt-5
            w-full
            resize-none
            rounded-[var(--radius-md)]
            border
            border-[var(--border)]
            bg-[var(--surface)]
            px-4
            py-4
            text-base
            leading-7
            outline-none
            transition
            focus:border-[var(--accent)]
          "
        />

        <p
          className={`
            mt-2
            text-xs

            ${hasError ? "text-[var(--danger)]" : "text-[var(--muted)]"}
          `}
        >
          {message || "離開文字框時會自動儲存"}
        </p>
      </section>

      <div className="mt-12 border-t border-[var(--border)] pt-10">
        {children}
      </div>

      <section className="mt-12 border-t border-[var(--border)] pt-8">
        <div
          className="
            rounded-[var(--radius-lg)]
            bg-[var(--surface-soft)]
            p-5
            sm:p-6
          "
        >
          <p className="font-story text-xl font-semibold">都好了嗎？</p>

          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            完成後，文字和照片會一起存進 Memories，這次 Date 也會進 Archive。
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isSaving || isCompleting}
              onClick={handleComplete}
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
              {isCompleting ? "正在建立回憶…" : "完成並存進 Memories"}
            </button>

            {!hasPhotos && (
              <p className="text-xs text-[var(--muted)]">至少需要一張照片</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
