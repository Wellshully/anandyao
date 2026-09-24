"use client";

import { calculateItinerarySchedule } from "@/features/dates/lib/calculate-itinerary-schedule";

import { getItineraryTimeState } from "@/features/dates/lib/get-itinerary-time-state";

import { useCurrentTime } from "@/lib/time/use-current-time";

import ItineraryCard from "@/features/dates/components/ItineraryCard";

import type { DateItineraryItem } from "@/features/dates/types";

type ReadonlyItineraryListProps = {
  dateId: string;

  date: string;

  planningStartTime: string;

  items: DateItineraryItem[];
};

export default function ReadonlyItineraryList({
  dateId,
  date,
  planningStartTime,
  items,
}: ReadonlyItineraryListProps) {
  const now = useCurrentTime();

  const scheduledItems = calculateItinerarySchedule(planningStartTime, items);

  return (
    <div className="space-y-3">
      {scheduledItems.map((scheduled) => {
        const timeInfo = now
          ? getItineraryTimeState({
              date,

              startMinutes: scheduled.startMinutes,

              endMinutes: scheduled.endMinutes,

              now,
            })
          : undefined;

        return (
          <ItineraryCard
            key={scheduled.item.id}
            dateId={dateId}
            item={scheduled.item}
            scheduledTime={scheduled.displayStartTime}
            hasConflict={scheduled.hasConflict}
            timeState={timeInfo?.state}
            isSoon={timeInfo?.isSoon}
            minutesUntilStart={timeInfo?.minutesUntilStart}
            canEdit={false}
          />
        );
      })}
    </div>
  );
}
