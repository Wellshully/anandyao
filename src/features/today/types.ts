import type { Database } from "@/types/database";

export type PersonalPlan =
  Database["public"]["Tables"]["personal_plans"]["Row"];

export type TodayItemKind =
  | "date"
  | "personal"
  | "study_assignment"
  | "study_announcement"
  | "study_mail";

export type TodayItem = {
  id: string;

  kind: TodayItemKind;

  title: string;

  subtitle: string | null;

  startAt: number | null;

  endAt: number | null;

  href: string | null;

  completed: boolean;
};

export type CreatePersonalPlanInput = {
  title: string;

  startTime?: string;

  durationMinutes: number;
};
