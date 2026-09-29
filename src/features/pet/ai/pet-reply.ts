import { z } from "zod";

export const petPoseSchema = z.enum([
  "normal",
  "cute",
  "happy",
  "excited",
  "angry",
  "sad",
  "resting",
  "sleeping",
  "love",
  "petted",
  "playing",
  "rolling",
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

export const petTaskTemporalKindSchema =
  z.enum([
    "scheduled",
    "deadline",
    "flexible",
  ]);

export const petTaskTimePrecisionSchema =
  z.enum([
    "none",
    "date",
    "daypart",
    "exact",
  ]);

export const petTaskCandidateSchema =
  z.object({
    title:
      z.string().min(1).max(120),

    note:
      z.string().max(300).nullable(),

    dueAt:
      z.string().max(64).nullable(),

    temporalKind:
      petTaskTemporalKindSchema,

    timePrecision:
      petTaskTimePrecisionSchema,

    timeExpression:
      z.string().max(64).nullable(),
  });

export const petTaskActionSchema = z.object({
  action: z.enum(["create", "complete", "cancel"]),

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
});

export type PetPose = z.infer<typeof petPoseSchema>;

export type PetMemoryType = z.infer<typeof petMemoryTypeSchema>;

export type PetMemorySubject = z.infer<typeof petMemorySubjectSchema>;

export type PetMemoryCandidate = z.infer<typeof petMemoryCandidateSchema>;

export type PetTaskCandidate = z.infer<typeof petTaskCandidateSchema>;

export type PetTaskActionCandidate = z.infer<typeof petTaskActionSchema>;

export type PetReply = z.infer<typeof petReplySchema>;
