import type { PetDailyReport as PetDailyReportData } from "@/features/pet/report/types";

type PetDailyReportProps = {
  report: PetDailyReportData | null;
};

function formatReportDate(date: string) {
  const [year, month, day] = date.split("-");

  if (!year || !month || !day) {
    return date;
  }

  return `${year}/${month}/${day}`;
}

function formatCreatedAt(createdAt: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",

    month: "2-digit",
    day: "2-digit",

    hour: "2-digit",
    minute: "2-digit",

    hour12: false,
  }).format(new Date(createdAt));
}

export default function PetDailyReport({
  report,
}: PetDailyReportProps) {
  return (
    <section
      id="pet-daily-report"
      className="mx-auto mt-10 max-w-2xl scroll-mt-6"
    >
      <div
        className="
          rounded-[var(--radius-md)]
          border
          border-[var(--border)]
          bg-[var(--surface)]
          p-5
        "
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Pet Report
            </p>

            <h2 className="font-story mt-2 text-xl font-semibold">
              萌蛋的每日報告
            </h2>
          </div>

          {report && (
            <span
              className="
                shrink-0
                rounded-full
                bg-[var(--surface-soft)]
                px-3
                py-1
                text-xs
                text-[var(--muted)]
              "
            >
              {formatReportDate(report.reportDate)}
            </span>
          )}
        </div>

        {report ? (
          <>
            <div
              className="
                mt-5
                rounded-2xl
                bg-[var(--surface-soft)]
                px-5
                py-4
              "
            >
              <p className="whitespace-pre-wrap text-sm leading-7">
                {report.content}
              </p>
            </div>

            <p className="mt-3 text-right text-xs text-[var(--muted)]">
              產生於 {formatCreatedAt(report.createdAt)}
            </p>
          </>
        ) : (
          <div
            className="
              mt-5
              rounded-2xl
              bg-[var(--surface-soft)]
              px-5
              py-4
            "
          >
            <p className="text-sm leading-6 text-[var(--muted)]">
              還沒有每日報告。到了你設定的時間後，萌蛋會把近期值得注意的事情整理在這裡。
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
