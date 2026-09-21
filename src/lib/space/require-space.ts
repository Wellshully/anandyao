import { redirect } from "next/navigation";

import { getCurrentSpace } from "./get-current-space";

export async function requireSpace() {
  const space = await getCurrentSpace();

  if (!space) {
    redirect("/setup");
  }

  return space;
}
