import { cookies } from "next/headers";
import { connection } from "next/server";

import BirthdayExperience from "@/features/birthday/components/BirthdayExperience";
import { isBirthday } from "@/features/birthday/lib/isBirthday";
import NormalHome from "@/features/home/components/NormalHome";
import { requireUser } from "@/lib/auth/require-user";
import { requireSpace } from "@/lib/space/require-space";

type HomePageProps = {
  searchParams: Promise<{
    preview?: string | string[];
    birthday?: string | string[];
  }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  await connection();

  const params = await searchParams;

  const previewBirthday =
    process.env.NODE_ENV === "development" && params.preview === "birthday";

  const birthdayDismissed =
    params.birthday === "done" ||
    (await cookies()).get("an_yao_birthday_seen")?.value === "1";

  const showBirthday =
    previewBirthday || (isBirthday(new Date()) && !birthdayDismissed);

  if (showBirthday) {
    return <BirthdayExperience />;
  }

  await requireUser();
  await requireSpace();

  return <NormalHome />;
}
