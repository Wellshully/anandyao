import type { PetPose } from "@/features/pet/ai/pet-reply";

export type PetReportSettings = {
  enabled: boolean;
  reportTime: string;
  timeZone: string;
};

export type PetDailyReport = {
  id: string;

  reportDate: string;

  content: string;

  pose: PetPose;

  createdAt: string;
};
