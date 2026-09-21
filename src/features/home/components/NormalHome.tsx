import Link from "next/link";

import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import { siteConfig } from "@/config/site";

export default function NormalHome() {
  const features = siteConfig.navigation.slice(1);

  return (
    <AppShell>
      <section>
        <p className="text-sm text-neutral-500">
          Our little place on the internet.
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {siteConfig.name}
        </h1>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <Link key={feature.href} href={feature.href}>
              <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-sm">
                <h2 className="text-lg font-medium">{feature.label}</h2>

                <p className="mt-2 text-sm text-neutral-500">
                  Open {feature.label.toLowerCase()}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
