import Link from "next/link";

import Container from "@/components/ui/Container";
import { siteConfig } from "@/config/site";
import { signOut } from "@/app/auth/actions";
export default function SiteHeader() {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <Container>
        <div className="flex min-h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="shrink-0 text-lg font-semibold tracking-tight"
          >
            {siteConfig.name}
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {siteConfig.navigation.slice(1).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-neutral-500 transition hover:text-neutral-950"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-neutral-500 transition hover:text-neutral-950"
            >
              Sign out
            </button>
          </form>
          <nav className="flex items-center gap-3 overflow-x-auto md:hidden">
            {siteConfig.navigation.slice(1).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap text-xs text-neutral-500"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </Container>
    </header>
  );
}
