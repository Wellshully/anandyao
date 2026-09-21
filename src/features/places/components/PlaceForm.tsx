import Button from "@/components/ui/Button";
import {
  PLACE_STATUSES,
  type PlaceStatus,
} from "@/features/places/config/place-status";

type PlaceFormData = {
  id?: string;
  name?: string;
  status?: PlaceStatus;
  note?: string | null;
  address?: string | null;
  visited_on?: string | null;
};

type PlaceFormProps = {
  action: (formData: FormData) => void | Promise<void>;

  place?: PlaceFormData;

  submitLabel: string;
};

export default function PlaceForm({
  action,
  place,
  submitLabel,
}: PlaceFormProps) {
  return (
    <form action={action} className="space-y-5">
      {place?.id && <input type="hidden" name="placeId" value={place.id} />}

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          Place
        </label>

        <input
          id="name"
          name="name"
          defaultValue={place?.name ?? ""}
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
          defaultValue={place?.status ?? "want_to_go"}
          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2"
        >
          {PLACE_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="address" className="mb-1 block text-sm font-medium">
          Address
        </label>

        <input
          id="address"
          name="address"
          defaultValue={place?.address ?? ""}
          placeholder="Optional"
          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="visitedOn" className="mb-1 block text-sm font-medium">
          Visited date
        </label>

        <input
          id="visitedOn"
          name="visitedOn"
          type="date"
          defaultValue={place?.visited_on ?? ""}
          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2"
        />

        <p className="mt-1 text-xs text-neutral-500">
          Leave empty if we haven&apos;t visited yet.
        </p>
      </div>

      <div>
        <label htmlFor="note" className="mb-1 block text-sm font-medium">
          Note
        </label>

        <textarea
          id="note"
          name="note"
          rows={6}
          defaultValue={place?.note ?? ""}
          placeholder="Why do we want to go?"
          className="w-full resize-y rounded-xl border border-neutral-200 bg-white px-3 py-2"
        />
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
