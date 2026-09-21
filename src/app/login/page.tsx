import { redirect } from "next/navigation";

import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";

import { login } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();

  if (data?.claims?.sub) {
    redirect("/");
  }

  const params = await searchParams;

  const errorMessage =
    params.error === "missing"
      ? "Please enter your email and password."
      : params.error === "invalid"
        ? "Email or password is incorrect."
        : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">An & Yao</h1>

          <p className="mt-2 text-sm text-neutral-500">
            Sign in to our little place.
          </p>
        </div>

        <form
          action={login}
          className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6"
        >
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 outline-none focus:border-neutral-400"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium"
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 outline-none focus:border-neutral-400"
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-red-600">{errorMessage}</p>
          )}

          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
      </div>
    </main>
  );
}
