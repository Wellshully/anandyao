export type AdventureQuestMode =
  | "pet_actions"
  | "couple";

export function selectQuestMode(
  roll: number,
): AdventureQuestMode {
  if (
    !Number.isInteger(roll) ||
    (roll !== 0 && roll !== 1)
  ) {
    throw new Error("Quest mode roll must be 0 or 1");
  }

  return roll === 0 ? "pet_actions" : "couple";
}
