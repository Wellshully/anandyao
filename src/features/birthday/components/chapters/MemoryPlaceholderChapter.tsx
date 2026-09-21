type MemoryPlaceholderChapterProps = {
  index: string;
};

export default function MemoryPlaceholderChapter({
  index,
}: MemoryPlaceholderChapterProps) {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <p className="text-xs uppercase tracking-[0.3em] text-[var(--birthday-accent)]">
        Memory {index}
      </p>

      <div className="mt-8 grid gap-8 md:grid-cols-2 md:items-center">
        <div
          className="
            aspect-[4/5]
            rounded-[2rem]
            border
            border-white/10
            bg-white/[0.04]
          "
        />

        <div>
          <p className="text-sm text-[var(--birthday-muted)]">
            這裡之後會放一段回憶
          </p>

          <h2 className="font-story mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
            Memory Chapter
          </h2>

          <p className="mt-6 max-w-md leading-7 text-[var(--birthday-muted)]">
            這一章之後可以是一張照片、 一個問題、一個小遊戲，
            或某段只有你們知道的事情。
          </p>
        </div>
      </div>
    </div>
  );
}
