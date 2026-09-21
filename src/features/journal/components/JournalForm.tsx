import Button from "@/components/ui/Button";
import {
  JOURNAL_STATUSES,
  type JournalStatus,
} from "@/features/journal/config/journal-status";

type JournalFormData = {
  id?: string;
  title?: string;
  content?: string;
  entry_date?: string;
  status?: JournalStatus;
};

type JournalFormProps = {
  action:
    | ((formData: FormData) => void)
    | ((formData: FormData) => Promise<void>);

  entry?: JournalFormData;

  submitLabel: string;
};

export default function JournalForm({
  action,
  entry,
  submitLabel,
}: JournalFormProps) {
  return (
    <form action={action} className="space-y-5">
      {entry?.id && <input type="hidden" name="entryId" value={entry.id} />}

      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium">
          Title
        </label>

        <input
          id="title"
          name="title"
          defaultValue={entry?.title ?? ""}
          required
          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="entryDate" className="mb-1 block text-sm font-medium">
          Date
        </label>

        <input
          id="entryDate"
          name="entryDate"
          type="date"
          defaultValue={entry?.entry_date ?? ""}
          required
          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="status" className="mb-1 block text-sm font-medium">
          Status
        </label>

        <select
          id="status"
          name="status"
          defaultValue={entry?.status ?? "draft"}
          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2"
        >
          {JOURNAL_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-3">
          <label htmlFor="content" className="block text-sm font-medium">
            Content
          </label>

          <span className="text-xs text-neutral-400">Markdown supported</span>
        </div>

        <textarea
          id="content"
          name="content"
          rows={18}
          defaultValue={entry?.content ?? ""}
          required
          placeholder={`今天去了...

## 小標題

**粗體**

- 第一件事
- 第二件事`}
          className="w-full resize-y rounded-xl border border-neutral-200 bg-white px-3 py-3 font-mono text-sm leading-6"
        />
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
