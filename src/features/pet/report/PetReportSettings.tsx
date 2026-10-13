"use client";

import { useState, useTransition } from "react";

import { updatePetReportSettingsAction } from "@/features/pet/report/actions";

import type { PetReportSettings as PetReportSettingsData } from "@/features/pet/report/types";

type PetReportSettingsProps = {
  petId: string;
  initialSettings: PetReportSettingsData;
};

export default function PetReportSettings({
  petId,
  initialSettings,
}: PetReportSettingsProps) {
  const [enabled, setEnabled] = useState(initialSettings.enabled);

  const [reportTime, setReportTime] = useState(initialSettings.reportTime);

  const [message, setMessage] = useState("");

  const [isPending, startTransition] = useTransition();

  function save() {
    if (isPending) {
      return;
    }

    setMessage("");

    startTransition(async () => {
      const result = await updatePetReportSettingsAction({
        petId,
        enabled,
        reportTime,
      });

      if (!result.success) {
        setMessage(result.error);

        return;
      }

      setMessage("每日報告設定已儲存。");
    });
  }

  return (
    <section className="mx-auto mt-6 max-w-2xl">
      <details
        suppressHydrationWarning
        className="
          group
          overflow-hidden
          rounded-[var(--radius-md)]
          border
          border-[var(--border)]
          bg-[var(--surface)]
        "
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span className="flex flex-col gap-1">
            <span className="font-story text-base font-semibold">
              每日報告設定
            </span>
            <span className="text-xs text-[var(--muted)]">
              {enabled ? `已開啟 · 每天 ${reportTime}` : "已關閉"}
            </span>
          </span>
          <span
            aria-hidden="true"
            className="text-xl text-[var(--muted)] transition-transform group-open:rotate-180"
          >
            ⌄
          </span>
        </summary>

        <div className="border-t border-[var(--border)] p-5">
          <div className="flex items-start justify-between gap-5">
            <div>
              <h2 className="font-story text-xl font-semibold">自動產生報告</h2>

              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                讓萌蛋每天在指定時間整理今天值得注意的事情。
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled((current) => !current)}
              className={`
                relative
                h-7
                w-12
                shrink-0
                rounded-full
                transition

                ${enabled ? "bg-[var(--accent)]" : "bg-[var(--border)]"}
              `}
            >
              <span
                className={`
                  absolute
                  top-1
                  h-5
                  w-5
                  rounded-full
                  bg-white
                  shadow-sm
                  transition

                  ${enabled ? "left-6" : "left-1"}
                `}
              />
            </button>
          </div>

          <div className="mt-6">
            <label htmlFor="pet-report-time" className="text-sm font-medium">
              報告時間
            </label>

            <input
              id="pet-report-time"
              type="time"
              value={reportTime}
              onChange={(event) => setReportTime(event.target.value)}
              className="
                mt-2
                block
                w-full
                rounded-xl
                border
                border-[var(--border)]
                bg-[var(--background)]
                px-3
                py-2
                text-sm
              "
            />

            <p className="mt-2 text-xs text-[var(--muted)]">時區：Asia/Taipei</p>
          </div>

          <div
            className="
              mt-6
              rounded-xl
              bg-[var(--surface-soft)]
              px-4
              py-3
            "
          >
            <p className="text-xs leading-5 text-[var(--muted)]">
              每日報告之後會參考 Dates、Study、Today，以及你告訴萌蛋的近期待辦。
            </p>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <button
              type="button"
              disabled={isPending}
              onClick={save}
              className="
                rounded-xl
                bg-[var(--foreground)]
                px-4
                py-2
                text-sm
                font-medium
                text-[var(--on-foreground)]
                transition
                disabled:opacity-50
              "
            >
              {isPending ? "儲存中…" : "儲存設定"}
            </button>

            {message && <p className="text-xs text-[var(--muted)]">{message}</p>}
          </div>
        </div>
      </details>
    </section>
  );
}
