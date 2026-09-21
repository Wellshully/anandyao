export const PLACE_STATUSES = [
  {
    value: "want_to_go",
    label: "想去",
  },
  {
    value: "visited",
    label: "去過",
  },
  {
    value: "revisit",
    label: "想再去",
  },
] as const;

export type PlaceStatus = (typeof PLACE_STATUSES)[number]["value"];

export function isPlaceStatus(value: string): value is PlaceStatus {
  return PLACE_STATUSES.some((status) => status.value === value);
}

export function getPlaceStatusLabel(value: PlaceStatus) {
  return (
    PLACE_STATUSES.find((status) => status.value === value)?.label ?? value
  );
}
