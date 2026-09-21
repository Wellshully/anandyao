import Link from "next/link";

type HomeFeatureCardProps = {
  index: string;
  title: string;
  description: string;
  href: string;
};

export default function HomeFeatureCard({
  index,
  title,
  description,
  href,
}: HomeFeatureCardProps) {
  return (
    <Link href={href} className="group block">
      <article
        className="
          flex h-full min-h-52 flex-col justify-between
          rounded-[var(--radius-lg)]
          border border-[var(--border)]
          bg-[var(--surface)]
          p-6
          transition duration-300
          hover:-translate-y-1
          hover:shadow-[0_18px_45px_rgba(38,35,31,0.07)]
          sm:p-7
        "
      >
        <div className="flex items-start justify-between">
          <span className="text-xs tracking-[0.2em] text-[var(--muted)]">
            {index}
          </span>

          <span
            className="
              text-lg text-[var(--muted)]
              transition
              group-hover:translate-x-1
              group-hover:text-[var(--foreground)]
            "
          >
            →
          </span>
        </div>

        <div className="mt-10">
          <h2 className="font-story text-2xl font-semibold">{title}</h2>

          <p className="mt-3 max-w-xs text-sm leading-6 text-[var(--muted)]">
            {description}
          </p>
        </div>
      </article>
    </Link>
  );
}
