export type ItineraryTimeState = "past" | "current" | "upcoming";

export type ItineraryTimeInfo = {
  state: ItineraryTimeState;

  isSoon: boolean;

  minutesUntilStart: number | null;
};

function getDayStart(date: string) {
  return new Date(`${date}T00:00:00+08:00`).getTime();
}

export function getItineraryTimeState({
  date,
  startMinutes,
  endMinutes,
  now,
}: {
  date: string;

  startMinutes: number;
  endMinutes: number;

  now: number;
}): ItineraryTimeInfo {
  const dayStart = getDayStart(date);

  const start = dayStart + startMinutes * 60_000;

  const end = dayStart + endMinutes * 60_000;

  if (now >= end) {
    return {
      state: "past",

      isSoon: false,

      minutesUntilStart: null,
    };
  }

  if (now >= start && now < end) {
    return {
      state: "current",

      isSoon: false,

      minutesUntilStart: 0,
    };
  }

  const minutesUntilStart = Math.ceil((start - now) / 60_000);

  return {
    state: "upcoming",

    isSoon: minutesUntilStart > 0 && minutesUntilStart <= 60,

    minutesUntilStart,
  };
}
