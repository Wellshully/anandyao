"use client";

import { useMemo, useRef, useState, useTransition } from "react";

import { Reorder, useDragControls } from "motion/react";

import { useRouter } from "next/navigation";

import ItineraryCard from "@/features/dates/components/ItineraryCard";

import { reorderItineraryAction } from "@/features/dates/actions";

import { calculateItinerarySchedule } from "@/features/dates/lib/calculate-itinerary-schedule";

import {
  getItineraryTimeState,
  type ItineraryTimeState,
} from "@/features/dates/lib/get-itinerary-time-state";

import { useCurrentTime } from "@/lib/time/use-current-time";

import type { DateItineraryItem } from "@/features/dates/types";

type SortableItineraryListProps = {
  dateId: string;

  dateDayId: string;

  date: string;

  planningStartTime: string;

  items: DateItineraryItem[];
};

type SortableItineraryItemProps = {
  dateId: string;

  item: DateItineraryItem;

  scheduledTime?: string;

  hasConflict?: boolean;

  timeState?: ItineraryTimeState;

  isSoon?: boolean;

  minutesUntilStart?: number | null;

  isSaving: boolean;

  onDragStart: () => void;

  onDragEnd: () => void;
};

function SortableItineraryItem({
  dateId,
  item,
  scheduledTime,
  hasConflict,
  timeState,
  isSoon,
  minutesUntilStart,
  isSaving,
  onDragStart,
  onDragEnd,
}: SortableItineraryItemProps) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={item.id}
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="
    list-none
    select-none
  "
      whileDrag={{
        scale: 1.015,
      }}
    >
      <ItineraryCard
        dateId={dateId}
        item={item}
        scheduledTime={scheduledTime}
        hasConflict={hasConflict}
        timeState={timeState}
        isSoon={isSoon}
        minutesUntilStart={minutesUntilStart}
        dragDisabled={isSaving}
        onDragHandlePointerDown={(event) => {
          if (isSaving) {
            return;
          }

          dragControls.start(event);
        }}
      />
    </Reorder.Item>
  );
}

export default function SortableItineraryList({
  dateId,
  dateDayId,
  date,
  planningStartTime,
  items,
}: SortableItineraryListProps) {
  const router = useRouter();

  const now = useCurrentTime();

  const initialOrder = items.map((item) => item.id);

  const [order, setOrder] = useState<string[]>(initialOrder);

  const orderRef = useRef(order);

  const beforeDragRef = useRef(order);

  const [error, setError] = useState("");

  const [isSaving, startTransition] = useTransition();

  const itemMap = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );

  const orderedItems = order
    .map((id) => itemMap.get(id))
    .filter((item): item is DateItineraryItem => Boolean(item));

  const scheduledItems = calculateItinerarySchedule(
    planningStartTime,
    orderedItems,
  );

  const scheduleMap = new Map(
    scheduledItems.map((scheduled) => [scheduled.item.id, scheduled]),
  );

  function handleReorder(nextOrder: string[]) {
    orderRef.current = nextOrder;

    setOrder(nextOrder);
  }

  function handleDragStart() {
    beforeDragRef.current = [...orderRef.current];

    setError("");
  }

  function handleDragEnd() {
    const nextOrder = orderRef.current;

    const previousOrder = beforeDragRef.current;

    const unchanged =
      nextOrder.length === previousOrder.length &&
      nextOrder.every((id, index) => id === previousOrder[index]);

    if (unchanged) {
      return;
    }

    startTransition(async () => {
      const result = await reorderItineraryAction(dateId, dateDayId, nextOrder);

      if (!result.success) {
        orderRef.current = previousOrder;

        setOrder(previousOrder);

        setError(result.error);

        return;
      }

      beforeDragRef.current = [...nextOrder];

      router.refresh();
    });
  }

  return (
    <div>
      <Reorder.Group
        axis="y"
        values={order}
        onReorder={handleReorder}
        className="space-y-3"
      >
        {orderedItems.map((item) => {
          const scheduled = scheduleMap.get(item.id);

          const timeInfo =
            scheduled && now
              ? getItineraryTimeState({
                  date,

                  startMinutes: scheduled.startMinutes,

                  endMinutes: scheduled.endMinutes,

                  now,
                })
              : undefined;

          return (
            <SortableItineraryItem
              key={item.id}
              dateId={dateId}
              item={item}
              scheduledTime={scheduled?.displayStartTime}
              hasConflict={scheduled?.hasConflict}
              timeState={timeInfo?.state}
              isSoon={timeInfo?.isSoon}
              minutesUntilStart={timeInfo?.minutesUntilStart}
              isSaving={isSaving}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          );
        })}
      </Reorder.Group>

      {isSaving && (
        <p className="mt-3 text-xs text-[var(--muted)]">儲存新順序…</p>
      )}

      {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}
