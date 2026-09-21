export const JOURNAL_STATUSES = [
  {
    value: "draft",
    label: "Draft",
  },
  {
    value: "published",
    label: "Published",
  },
] as const;

export type JournalStatus = (typeof JOURNAL_STATUSES)[number]["value"];

export function isJournalStatus(value: string): value is JournalStatus {
  return JOURNAL_STATUSES.some((status) => status.value === value);
}
