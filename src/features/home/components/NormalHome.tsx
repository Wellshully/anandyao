import Link from "next/link";

import AppShell from "@/components/layout/AppShell";

import HomeDateHero from "@/features/home/components/HomeDateHero";

const modules = [
  {
    href: "/eat",
    number: "01",
    title: "Eat",
    description: "今天要吃什麼？",
    action: "看看要吃什麼 →",
  },
  {
    href: "/places",
    number: "02",
    title: "Places",
    description: "想一起去、去過，或還想再去一次的地方。",
    action: "看看我們的地方 →",
  },
  {
    href: "/memories",
    number: "03",
    title: "Memories",
    description: "照片和一些值得留下來的片段。",
    action: "回去看看 →",
  },
  {
    href: "/journal",
    number: "04",
    title: "Journal",
    description: "想寫下來的事情，就是個記事本",
    action: "打開 Journal →",
  },
];

export default function NormalHome() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Homepage intro */}

        <section className="mb-10 sm:mb-14">
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--accent)]">
            Our little place
          </p>

          <h1 className="font-story mt-3 text-4xl font-semibold sm:text-5xl">
            An & Yao
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base">
            給安的生日禮物。
          </p>
        </section>

        {/* Date is the main feature */}

        <HomeDateHero />

        {/* Other modules */}

        <section className="mt-16 sm:mt-20">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
                Our things
              </p>

              <h2 className="font-story mt-3 text-3xl font-semibold sm:text-4xl">
                所有功能
              </h2>
            </div>

            <Link
              href="/dates"
              className="
                hidden
                shrink-0
                text-sm
                font-medium
                text-[var(--accent)]
                sm:block
              "
            >
              所有 Dates →
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {modules.map((module) => (
              <Link
                key={module.href}
                href={module.href}
                className="
                  group
                  flex
                  min-h-56
                  flex-col
                  justify-between
                  rounded-[var(--radius-lg)]
                  border
                  border-[var(--border)]
                  bg-[var(--surface)]
                  p-6
                  transition
                  hover:-translate-y-0.5
                  hover:border-[var(--foreground)]
                  sm:p-7
                "
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-[10px] tracking-[0.2em] text-[var(--muted)]">
                      {module.number}
                    </p>

                    <span
                      className="
                        text-sm
                        text-[var(--muted)]
                        transition-transform
                        group-hover:translate-x-1
                      "
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </div>

                  <h3 className="font-story mt-8 text-3xl font-semibold">
                    {module.title}
                  </h3>

                  <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--muted)]">
                    {module.description}
                  </p>
                </div>

                <p className="mt-8 text-sm font-medium text-[var(--accent)]">
                  {module.action}
                </p>
              </Link>
            ))}
          </div>

          <Link
            href="/dates"
            className="
              mt-5
              inline-block
              text-sm
              font-medium
              text-[var(--accent)]
              sm:hidden
            "
          >
            所有 Dates →
          </Link>
        </section>

        {/* Footer */}

        <section
          className="
            mt-20
            border-t
            border-[var(--border)]
            py-10
            text-center
            sm:mt-24
            sm:py-14
          "
        >
          <p className="text-sm text-[var(--muted)] sm:text-base">
            有什麼想要功能直接告訴我呦
          </p>
        </section>
      </main>
    </AppShell>
  );
}
