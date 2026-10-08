import type {
  PetRecurringOccurrenceAction,
} from "./pet-reply";

type OverrideFields = Pick<
  PetRecurringOccurrenceAction,
  | "titleOverride"
  | "noteOverride"
  | "timePrecisionOverride"
  | "startTimeOverride"
>;

type ExistingException = {
  kind: string;
  title_override: string | null;
  note_override: string | null;
  time_precision_override: string | null;
  start_time_override: string | null;
};

export function mergePetRecurringOccurrenceOverride(
  change: OverrideFields,
  existing: ExistingException | null,
) {
  const previous =
    existing?.kind === "override"
      ? existing
      : null;

  return {
    title_override:
      change.titleOverride ??
      previous?.title_override ??
      null,

    note_override:
      change.noteOverride ??
      previous?.note_override ??
      null,

    time_precision_override:
      change.timePrecisionOverride ??
      previous?.time_precision_override ??
      null,

    start_time_override:
      change.timePrecisionOverride === null
        ? previous?.start_time_override ?? null
        : change.timePrecisionOverride === "exact"
          ? change.startTimeOverride
          : null,
  };
}
