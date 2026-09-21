import Link from "next/link";

import AppShell from "@/components/layout/AppShell";
import { siteConfig } from "@/config/site";

export default function NormalHome() {
  const features = siteConfig.navigation.slice(1);

  return (
    <AppShell>
      <section>
        <div>
          <p className="text-sm text-neutral-500">
            Our little place on the internet. :)
          </p>

          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            An & Yao
          </h1>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <Link
              key={feature.href}
              href={feature.href}
              className="rounded-2xl border border-neutral-200 p-6 transition hover:bg-neutral-50"
            >
              <h2 className="text-xl font-medium">{feature.label}</h2>

              <p className="mt-2 text-sm text-neutral-500">
                Open {feature.label.toLowerCase()}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
