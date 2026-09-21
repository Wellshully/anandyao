import Link from "next/link";

import { signOut } from "@/app/auth/actions";
import Container from "@/components/ui/Container";
import { siteConfig } from "@/config/site";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color:var(--background)]/90 backdrop-blur-md">
      <Container>
        <div className="flex min-h-16 items-center justify-between gap-6">
          <Link
            href="/"
            className="font-story shrink-0 text-xl font-semibold tracking-tight"
          >
            An & Yao
          </Link>

          <div className="flex min-w-0 items-center gap-6">
            <nav className="hidden items-center gap-6 md:flex">
              {siteConfig.navigation.slice(1).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <form action={signOut}>
              <button
                type="submit"
                className="whitespace-nowrap text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <nav className="flex gap-5 overflow-x-auto border-t border-[var(--border)] py-3 md:hidden">
          {siteConfig.navigation.slice(1).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap text-xs text-[var(--muted)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </Container>
    </header>
  );
}
