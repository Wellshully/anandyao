import type { Database } from "@/types/database";

export type SharedDate = Database["public"]["Tables"]["dates"]["Row"];

export type DateParticipant =
  Database["public"]["Tables"]["date_participants"]["Row"];

export type DateDay = Database["public"]["Tables"]["date_days"]["Row"];

export type DateItineraryItem =
  Database["public"]["Tables"]["date_itinerary_items"]["Row"];

export type DateKind = "meal" | "date" | "half_day" | "day" | "trip";

export type DateParticipantSummary = {
  userId: string;

  role: "organizer" | "invitee";

  status: "pending" | "accepted" | "declined";

  displayName: string;
};

export type DateListItem = {
  date: SharedDate;

  participants: DateParticipantSummary[];

  currentUserParticipant?: DateParticipantSummary;
};

export type CreateDateInput = {
  title: string;
  description?: string;

  kind: DateKind;

  startDate: string;
  endDate: string;
};
export type ItineraryItemType =
  | "place"
  | "restaurant"
  | "transport"
  | "hotel"
  | "activity"
  | "note";

export type ItineraryTimingType = "flexible" | "fixed";

export type AddItineraryInput = {
  dateId: string;
  dateDayId: string;

  itemType: ItineraryItemType;

  title: string;
  description?: string;

  locationName?: string;
  address?: string;
  googleMapsUrl?: string;

  timingType: ItineraryTimingType;

  fixedStartTime?: string;

  durationMinutes: number;

  restaurantId?: string;
  placeId?: string;
};

export type DatePlannerDay = {
  day: DateDay;
  items: DateItineraryItem[];
};

export type DateDetails = {
  date: SharedDate;

  days: DatePlannerDay[];

  participants: DateParticipantSummary[];

  currentUserParticipant?: DateParticipantSummary;
};
export type PlannerPlace = Pick<
  Database["public"]["Tables"]["places"]["Row"],
  "id" | "name" | "status" | "note" | "address" | "latitude" | "longitude"
>;
