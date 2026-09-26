export type AppContextSource = "places" | "dates" | "study";
export type PetPlaceContextItem = {
  name: string;
  status: string;
  statusLabel: string;
  address: string | null;
  note: string | null;
  visitedOn: string | null;
};

export type PetDateItineraryItem = {
  type: string;
  title: string;
  description: string | null;
  locationName: string | null;
  address: string | null;
  fixedStartTime: string | null;
};

export type PetDateDayContext = {
  date: string;
  dayNumber: number;
  title: string | null;
  note: string | null;
  items: PetDateItineraryItem[];
};

export type PetDateContextItem = {
  title: string;
  description: string | null;
  temporalStatus: "past" | "current" | "upcoming";
  kind: string;
  status: string;
  startDate: string;
  endDate: string;
  participants: string[];
  days: PetDateDayContext[];
};
export type PetPlacesContext = {
  total: number;

  wantToGo: PetPlaceContextItem[];

  visited: PetPlaceContextItem[];

  revisit: PetPlaceContextItem[];
};
export type PetDatesContext = {
  currentDate: string;
  timeZone: string;
  total: number;
  items: PetDateContextItem[];
};
export type PetStudyAssignmentContextItem = {
  title: string;
  courseName: string;
  dueAt: string;
  late: boolean;
  missing: boolean;
  deadlinePassed: boolean;
};
export type PetStudyContext = {
  currentDate: string;
  timeZone: string;

  dueToday: PetStudyAssignmentContextItem[];
  overdue: PetStudyAssignmentContextItem[];
  upcoming: PetStudyAssignmentContextItem[];
};
export type PetAppContext = {
  places?: PetPlacesContext;
  dates?: PetDatesContext;
  study?: PetStudyContext;
};
