import "server-only";

import {
  getCurrentSpaceRole,
} from "@/features/profile/lib/get-current-space-role";

import {
  getProjectUsage,
} from "@/features/profile/lib/get-project-usage";

const STORAGE_LIMIT =
  1_000_000_000;

const DATABASE_LIMIT =
  500_000_000;

function formatBytes(
  bytes: number,
) {
  if (bytes < 1_000_000) {
    return `${(
      bytes / 1_000
    ).toFixed(0)} KB`;
  }

  if (
    bytes <
    1_000_000_000
  ) {
    return `${(
      bytes / 1_000_000
    ).toFixed(1)} MB`;
  }

  return `${(
    bytes /
    1_000_000_000
  ).toFixed(2)} GB`;
}

function UsageRow({
  label,
  used,
  limit,
  limitLabel,
}: {
  label: string;
  used: number;
  limit: number;
  limitLabel: string;
}) {
  const percent =
    Math.min(
      100,
      Math.max(
        0,
        (used / limit) *
          100,
      ),
    );

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm opacity-70">
            {label}
          </div>

          <div className="mt-2 text-2xl font-semibold">
            {formatBytes(
              used,
            )}
          </div>
        </div>

        <div className="text-right text-xs opacity-60">
          <div>
            {percent.toFixed(
              1,
            )}
            %
          </div>

          <div>
            of {limitLabel}
          </div>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]">
        <div
          className={
            percent >= 80
              ? "h-full rounded-full bg-[var(--danger)]"
              : "h-full rounded-full bg-[var(--accent)]"
          }
          style={{
            width:
              `${percent}%`,
          }}
        />
      </div>
    </div>
  );
}

export async function ProjectUsageSystemPanel() {
  const role =
    await getCurrentSpaceRole();

  if (role !== "owner") {
    return null;
  }

  const usage =
    await getProjectUsage();

  if (!usage) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">
        Project Usage
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <UsageRow
          label="Files"
          used={
            usage.storageBytes
          }
          limit={
            STORAGE_LIMIT
          }
          limitLabel="1 GB"
        />

        <UsageRow
          label="Database"
          used={
            usage.databaseBytes
          }
          limit={
            DATABASE_LIMIT
          }
          limitLabel="500 MB"
        />
      </div>
    </section>
  );
}
