import HomeFeatureCard from "@/features/home/components/HomeFeatureCard";
import { HOME_FEATURES } from "@/features/home/config/home-features";
import AppShell from "@/components/layout/AppShell";

export default function NormalHome() {
  return (
    <AppShell>
      <section className="py-4 sm:py-10">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--accent)]">
            Our little place
          </p>

          <h1
            className="
              font-story
              mt-5
              text-5xl
              font-semibold
              leading-[1.08]
              tracking-tight
              sm:text-6xl
              lg:text-7xl
            "
          >
            An & Yao
          </h1>

          <p
            className="
              mt-6
              max-w-xl
              text-base
              leading-7
              text-[var(--muted)]
              sm:text-lg
            "
          >
            收藏我們一起經過的地方、 發生過的事情，
            還有那些希望以後不會忘記的日常。
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {HOME_FEATURES.map((feature) => (
            <HomeFeatureCard key={feature.href} {...feature} />
          ))}
        </div>

        <section className="mt-20 border-t border-[var(--border)] pt-10">
          <div className="grid gap-6 sm:grid-cols-[1fr_2fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                An & Yao
              </p>
            </div>

            <p className="font-story max-w-xl text-xl leading-8 text-[var(--foreground)]">
              這裡不用有一個明確的目的。 只是希望很多年以後，
              我們還能回來看看當時的自己。
            </p>
          </div>
        </section>
      </section>
    </AppShell>
  );
}
