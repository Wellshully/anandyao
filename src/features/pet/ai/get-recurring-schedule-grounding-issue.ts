import type {
  PetRecurringScheduleAction,
} from "@/features/pet/ai/pet-reply";

function normalizeGroundingText(
  value: string,
) {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, "");
}

export function getRecurringScheduleGroundingIssue(
  message: string,
  actions: PetRecurringScheduleAction[],
): string | null {
  const normalizedMessage =
    normalizeGroundingText(
      message,
    );

  for (const action of actions) {
    if (
      action.action !== "create"
    ) {
      continue;
    }

    if (!action.schedule) {
      return (
        "Recurring schedule create action " +
        "requires schedule data."
      );
    }

    const expression =
      normalizeGroundingText(
        action.schedule
          .recurrenceExpression,
      );

    if (
      !normalizedMessage.includes(
        expression,
      )
    ) {
      return (
        "Recurring schedule expression " +
        "is not grounded in the current " +
        "user message."
      );
    }
  }

  return null;
}
