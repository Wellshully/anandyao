import PetPanel from "@/features/pet/components/PetPanel";

import PetDailyReport from "@/features/pet/report/PetDailyReport";
import PetReportSettings from "@/features/pet/report/PetReportSettings";

import { getPet } from "@/features/pet/lib/get-pet";

import { getLatestPetDailyReport } from "@/features/pet/report/get-latest-report";
import { getPetReportSettings } from "@/features/pet/report/get-report-settings";

import { requireUser } from "@/lib/auth/require-user";

export default async function PetPage() {
  const [pet, user] = await Promise.all([
    getPet(),
    requireUser(),
  ]);

  const [report, reportSettings] = await Promise.all([
    getLatestPetDailyReport(pet.id),
    getPetReportSettings(pet.id),
  ]);

  return (
    <>
      <PetPanel
        petId={pet.id}
        currentUserId={user.id}
        name={pet.name}
        initialState={pet.state}
      />

      <PetDailyReport report={report} />

      <PetReportSettings
        petId={pet.id}
        initialSettings={reportSettings}
      />
    </>
  );
}
