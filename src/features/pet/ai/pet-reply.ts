import { z } from "zod";

export const petPoseSchema = z.enum([
  // pet00
  "normal",

  // pet01
  "cute",

  // pet02
  "love",

  // pet03
  "excited",

  // pet04
  "happy",

  // pet05
  "playing",

  // pet06
  "confused",

  // pet07
  "thinking",

  // pet08
  "surprised",

  // pet09
  "sad",

  // pet10
  "angry",

  // pet11
  "resting",

  // pet12
  "working",

  // pet13
  "drinking",

  // pet14
  "eating",

  // pet15
  "studying",

  // pet16
  "phone",

  // pet17
  "music",

  // pet18
  "sleeping",

  // pet19
  "hiding",

  // pet20
  "rolling",

  // pet21
  "exhausted",

  // pet22
  "food",

  // pet23
  "petted",
]);

export const petMemoryTypeSchema = z.enum([
  "preference",
  "person_fact",
  "shared_memory",
  "temporary",
]);

export const petMemorySubjectSchema = z.enum([
  "current_user",
  "partner",
  "shared",
]);

export const petMemoryCandidateSchema = z.object({
  type: petMemoryTypeSchema,

  subject: petMemorySubjectSchema,

  content: z.string().min(1).max(200),

  importance: z.number().int().min(1).max(3),
});

export const petTaskTemporalKindSchema = z.enum([
  "scheduled",
  "deadline",
  "flexible",
]);

export const petTaskTimePrecisionSchema = z.enum([
  "none",
  "date",
  "daypart",
  "exact",
]);

export const petTaskCandidateSchema = z.object({
  title: z.string().min(1).max(120),

  note: z.string().max(300).nullable(),

  dueAt: z.string().max(64).nullable(),

  temporalKind: petTaskTemporalKindSchema,

  timePrecision: petTaskTimePrecisionSchema,

  timeExpression: z.string().max(64).nullable(),
});

export const petRecurringScheduleCandidateSchema = z.object({
  title: z.string().min(1).max(120),

  note: z.string().max(300).nullable(),

  /*
   * Preserve the owner's original
   * recurrence wording.
   *
   * Examples:
   * 每週二跟五
   * 隔週四
   * 每週二晚上七點
   */
  recurrenceExpression: z.string().min(1).max(120),
});

export const petRecurringScheduleActionSchema = z.object({
  action: z.enum(["create", "cancel"]),

  scheduleId: z.string().max(64).nullable(),

  schedule: petRecurringScheduleCandidateSchema.nullable(),
});

export const petRecurringOccurrenceActionSchema = z
  .object({
    action: z.enum(["override", "cancel", "restore"]),
    scheduleId: z.string().uuid(),
    occurrenceDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const timestamp = Date.parse(`${value}T00:00:00Z`);
        return (
          Number.isFinite(timestamp) &&
          new Date(timestamp).toISOString().slice(0, 10) === value
        );
      }, "Invalid occurrence date"),
    titleOverride: z.string().min(1).max(120).nullable(),
    noteOverride: z.string().max(300).nullable(),
    timePrecisionOverride: z
      .enum(["none", "daypart", "exact"])
      .nullable(),
    startTimeOverride: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/)
      .nullable(),
  })
  .superRefine((value, ctx) => {
    const hasOverride =
      value.titleOverride !== null ||
      value.noteOverride !== null ||
      value.timePrecisionOverride !== null;

    const invalid = (message: string) => {
      ctx.addIssue({
        code: "custom",
        message,
      });
    };

    if (value.action !== "override") {
      if (hasOverride || value.startTimeOverride !== null) {
        invalid("Cancel and restore cannot contain overrides.");
      }
      return;
    }

    if (!hasOverride) {
      invalid("Override requires at least one changed field.");
    }

    if (value.timePrecisionOverride === "exact") {
      if (!value.startTimeOverride) {
        invalid("Exact time requires startTimeOverride.");
      }
    } else if (value.startTimeOverride !== null) {
      invalid("Start time requires exact precision.");
    }
  });

export const petRecurringOccurrenceAIActionSchema = z.object({
  action: z.enum(["override", "cancel", "restore"]),
  scheduleId: z.string().uuid(),
  occurrenceDate: z.string(),
  titleOverride: z.string().nullable(),
  noteOverride: z.string().nullable(),
  timePrecisionOverride: z
    .enum(["none", "daypart", "exact"])
    .nullable(),
  startTimeOverride: z.string().nullable(),
});

export const petTaskActionSchema = z.object({
  action: z.enum(["create", "update", "complete", "cancel"]),

  /*
   * create:
   * taskId = null
   * task = task data
   *
   * complete / cancel:
   * taskId = existing pending task id
   * task = null
   */
  taskId: z.string().max(64).nullable(),

  task: petTaskCandidateSchema.nullable(),
});

export const petReplySchema = z.object({
  reply: z.string().min(1).max(160),

  pose: petPoseSchema,

  memory: petMemoryCandidateSchema.nullable(),

  taskActions: z.array(petTaskActionSchema).max(3),

  recurringScheduleActions: z.array(petRecurringScheduleActionSchema).max(3),

  recurringOccurrenceActions: z
    .array(petRecurringOccurrenceAIActionSchema)
    .max(3),
});

export type PetPose = z.infer<typeof petPoseSchema>;

export type PetMemoryType = z.infer<typeof petMemoryTypeSchema>;

export type PetMemorySubject = z.infer<typeof petMemorySubjectSchema>;

export type PetMemoryCandidate = z.infer<typeof petMemoryCandidateSchema>;

export type PetTaskCandidate = z.infer<typeof petTaskCandidateSchema>;

export type PetTaskActionCandidate = z.infer<typeof petTaskActionSchema>;

export type PetReply = z.infer<typeof petReplySchema>;

export type PetRecurringScheduleCandidate = z.infer<
  typeof petRecurringScheduleCandidateSchema
>;

export type PetRecurringScheduleAction = z.infer<
  typeof petRecurringScheduleActionSchema
>;

export type PetRecurringOccurrenceAction = z.infer<
  typeof petRecurringOccurrenceActionSchema
>;
