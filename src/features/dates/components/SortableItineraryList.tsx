"use client";

import { useMemo, useRef, useState, useTransition } from "react";

import { Reorder } from "motion/react";

import { useRouter } from "next/navigation";

import ItineraryCard from "@/features/dates/components/ItineraryCard";

import { reorderItineraryAction } from "@/features/dates/actions";

import { calculateItinerarySchedule } from "@/features/dates/lib/calculate-itinerary-schedule";

import type { DateItineraryItem } from "@/features/dates/types";

type SortableItineraryListProps = {
  dateId: string;

  dateDayId: string;

  planningStartTime: string;

  items: DateItineraryItem[];
};

export default function SortableItineraryList({
  dateId,
  dateDayId,
  planningStartTime,
  items,
}: SortableItineraryListProps) {
  const router = useRouter();

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

          return (
            <Reorder.Item
              key={item.id}
              value={item.id}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              dragListener={!isSaving}
              className="
                  list-none
                  touch-none
                "
              whileDrag={{
                scale: 1.015,
              }}
            >
              <ItineraryCard
                dateId={dateId}
                item={item}
                scheduledTime={scheduled?.displayStartTime}
                hasConflict={scheduled?.hasConflict}
              />
            </Reorder.Item>
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
