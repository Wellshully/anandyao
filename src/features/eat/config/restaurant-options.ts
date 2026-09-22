export const RESTAURANT_CONTEXTS = [
  {
    value: "one_person",
    label: "一個人",
  },
  {
    value: "date",
    label: "約會",
  },
  {
    value: "gathering",
    label: "聚餐",
  },
  {
    value: "quick",
    label: "快速吃",
  },
  {
    value: "slow",
    label: "慢慢吃",
  },
] as const;

export function getContextLabel(value: string) {
  return (
    RESTAURANT_CONTEXTS.find((context) => context.value === value)?.label ??
    value
  );
}
