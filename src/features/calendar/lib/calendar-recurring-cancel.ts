import { z } from "zod";

import {
  petRecurringOccurrenceActionSchema,
} from "../../pet/ai/pet-reply";

const occurrenceTargetSchema = z.object({
  scheduleId: z.string().uuid(),
  occurrenceDate: z.string(),
}).strict();

const seriesTargetSchema = z.object({
  scheduleId: z.string().uuid(),
}).strict();

export function buildCalendarOccurrenceCancellation(
  input: unknown,
) {
  const target = occurrenceTargetSchema.safeParse(input);

  if (!target.success) {
    return null;
  }

  const action = petRecurringOccurrenceActionSchema.safeParse({
    action: "cancel",
    scheduleId: target.data.scheduleId,
    occurrenceDate: target.data.occurrenceDate,
    titleOverride: null,
    noteOverride: null,
    timePrecisionOverride: null,
    startTimeOverride: null,
  });

  return action.success ? action.data : null;
}

export function buildCalendarSeriesCancellation(
  input: unknown,
) {
  const target = seriesTargetSchema.safeParse(input);

  if (!target.success) {
    return null;
  }

  return {
    action: "cancel" as const,
    scheduleId: target.data.scheduleId,
    schedule: null,
  };
}
