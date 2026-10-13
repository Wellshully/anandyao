import PetAdventure from "@/features/pet/adventure/PetAdventure";
import { requireUser } from "@/lib/auth/require-user";

export default async function PetAdventurePage() {
  await requireUser();

  return <PetAdventure refreshSignal={0} />;
}
