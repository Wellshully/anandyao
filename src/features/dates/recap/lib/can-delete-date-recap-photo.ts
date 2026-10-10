export type RecapPhotoDeletionEligibility = {
  recapStatus: string;
  dateStatus: string;
  participantStatus: string | null;
  windowState: string;
};

export function canDeleteDateRecapPhoto(
  input: RecapPhotoDeletionEligibility,
): boolean {
  return (
    input.recapStatus === "draft" &&
    input.dateStatus === "accepted" &&
    input.participantStatus === "accepted" &&
    input.windowState === "available"
  );
}
