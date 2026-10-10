export const OPEN_PERSONAL_PANEL_EVENT =
  "anandyao:open-personal-panel";

const PERSONAL_PREFIX = "today:personal:";

export function getPersonalPlanIdFromHomeItem(
  kind: string | null,
  itemId: string | null,
): string | null {
  if (
    kind !== "personal" ||
    !itemId?.startsWith(PERSONAL_PREFIX)
  ) {
    return null;
  }

  const planId = itemId.slice(PERSONAL_PREFIX.length);

  return planId.length > 0 ? planId : null;
}
