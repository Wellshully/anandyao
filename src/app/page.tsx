import { connection } from "next/server";

import BirthdayExperience from "@/features/birthday/components/BirthdayExperience";
import { isBirthday } from "@/features/birthday/lib/isBirthday";
import NormalHome from "@/features/home/components/NormalHome";
import { requireUser } from "@/lib/auth/require-user";
import { requireSpace } from "@/lib/space/require-space";

type HomePageProps = {
  searchParams: Promise<{
    preview?: string | string[];
  }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  await connection();

  const params = await searchParams;

  const previewBirthday =
    process.env.NODE_ENV === "development" && params.preview === "birthday";

  const showBirthday = previewBirthday || isBirthday(new Date());

  if (showBirthday) {
    return <BirthdayExperience />;
  }

  await requireUser();
  await requireSpace();

  return <NormalHome />;
}
