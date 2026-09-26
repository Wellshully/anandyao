export type PetMood = "normal" | "happy" | "sad" | "hungry" | "sleepy";

export type PetAction = "feed" | "pet" | "play";

export type PetAnimation = "idle" | "feed" | "pet" | "play";

export type PetState = {
  hunger: number;
  happiness: number;
  energy: number;

  xp: number;
  level: number;

  calculatedAt: string;
};

export type PetViewState = PetState & {
  mood: PetMood;
};
