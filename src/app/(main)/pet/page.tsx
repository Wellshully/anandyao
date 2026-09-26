import PetPanel from "@/features/pet/components/PetPanel";

import { getPet } from "@/features/pet/lib/get-pet";

export default async function PetPage() {
  const pet = await getPet();

  return <PetPanel name={pet.name} initialState={pet.state} />;
}
