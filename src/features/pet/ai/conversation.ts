export type PetConversationMessage = {
  role: "user" | "pet";
  content: string;
  createdAt: string | null;
};
export const PET_CONVERSATION_MAX_MESSAGES = 12;

export const PET_CONVERSATION_CHAR_BUDGET = 2400;

export function trimPetConversation(
  messages: PetConversationMessage[],
): PetConversationMessage[] {
  const recent = messages.slice(-PET_CONVERSATION_MAX_MESSAGES);

  const result: PetConversationMessage[] = [];

  let usedCharacters = 0;

  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const message = recent[index];

    if (
      usedCharacters + message.content.length >
      PET_CONVERSATION_CHAR_BUDGET
    ) {
      break;
    }

    result.unshift(message);
    usedCharacters += message.content.length;
  }

  return result;
}
