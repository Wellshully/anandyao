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

export const petReplySchema = z.object({
  reply: z.string().min(1).max(160),

  pose: petPoseSchema,
});

export type PetPose = z.infer<typeof petPoseSchema>;

export type PetReply = z.infer<typeof petReplySchema>;
