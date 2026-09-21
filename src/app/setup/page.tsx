import { redirect } from "next/navigation";

import Button from "@/components/ui/Button";
import { siteConfig } from "@/config/site";
import { requireUser } from "@/lib/auth/require-user";
import { getCurrentSpace } from "@/lib/space/get-current-space";

import { setupSpace } from "./actions";

export default async function SetupPage() {
  await requireUser();

  const existingSpace = await getCurrentSpace();

  if (existingSpace) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-sm text-neutral-500">Initial setup</p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {siteConfig.name}
          </h1>
        </div>

        <form
          action={setupSpace}
          className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6"
        >
          <div>
            <label
              htmlFor="displayName"
              className="mb-1 block text-sm font-medium"
            >
              Your name
            </label>

            <input
              id="displayName"
              name="displayName"
              type="text"
              defaultValue="堯"
              required
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 outline-none focus:border-neutral-400"
            />
          </div>

          <div className="rounded-xl bg-neutral-50 p-4">
            <p className="text-xs text-neutral-500">Shared space</p>

            <p className="mt-1 font-medium">{siteConfig.space.name}</p>
          </div>

          <Button type="submit" className="w-full">
            Create space
          </Button>
        </form>
      </div>
    </main>
  );
}
