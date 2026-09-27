import PetPanel from "@/features/pet/components/PetPanel";

import PetReportSettings from "@/features/pet/report/PetReportSettings";

import { getPet } from "@/features/pet/lib/get-pet";

import { getPetReportSettings } from "@/features/pet/report/get-report-settings";

import { requireUser } from "@/lib/auth/require-user";

export default async function PetPage() {
  const [pet, user] = await Promise.all([getPet(), requireUser()]);

  const reportSettings = await getPetReportSettings(pet.id);

  return (
    <>
      <PetPanel
        petId={pet.id}
        currentUserId={user.id}
        name={pet.name}
        initialState={pet.state}
      />

      <PetReportSettings petId={pet.id} initialSettings={reportSettings} />
    </>
  );
}
