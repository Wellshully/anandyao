export type DateRecapStatus = "draft" | "completed";

export type DateRecap = {
  id: string;

  date_id: string;

  space_id: string;

  created_by: string;

  favorite_moment: string | null;

  future_note: string | null;

  status: DateRecapStatus;

  completed_at: string | null;

  created_at: string;

  updated_at: string;
};
