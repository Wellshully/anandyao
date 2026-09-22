import Link from "next/link";

import Container from "@/components/ui/Container";

import RelationshipClock from "@/components/layout/RelationshipClock";

import { siteConfig } from "@/config/site";

import { signOut } from "@/app/auth/actions";

import { getTodayOverview } from "@/features/today/lib/get-today-overview";

export default async function SiteHeader() {
  const todayItems = await getTodayOverview();

  return (
    <header
      className="
        sticky
        top-0
        z-40
        border-b
        border-[var(--border)]
        bg-[color:var(--background)]/90
        backdrop-blur-md
      "
    >
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="
              font-story
              shrink-0
              text-xl
              font-semibold
              tracking-tight
            "
          >
            {siteConfig.name}
          </Link>

          <div className="flex min-w-0 items-center gap-4">
            <nav className="hidden items-center gap-6 md:flex">
              {siteConfig.navigation.slice(1).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="
                        text-sm
                        text-[var(--muted)]
                        transition
                        hover:text-[var(--foreground)]
                      "
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div
              className="
                h-8
                w-px
                bg-[var(--border)]
                max-md:hidden
              "
            />

            <RelationshipClock items={todayItems} />

            <form action={signOut}>
              <button
                type="submit"
                className="
                  hidden
                  text-xs
                  text-[var(--muted)]
                  transition
                  hover:text-[var(--foreground)]
                  md:block
                "
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <nav
          className="
            flex
            gap-5
            overflow-x-auto
            border-t
            border-[var(--border)]
            py-3
            md:hidden
          "
        >
          {siteConfig.navigation.slice(1).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="
                    shrink-0
                    text-sm
                    text-[var(--muted)]
                    transition
                    hover:text-[var(--foreground)]
                  "
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </Container>
    </header>
  );
}
