export default function LetterPlaceholderChapter() {
  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs uppercase tracking-[0.3em] text-[var(--birthday-accent)]">
        A letter
      </p>

      <h2 className="font-story mt-8 text-4xl font-semibold sm:text-5xl">
        有些話，留到這裡再說。
      </h2>

      <div className="font-story mt-10 space-y-6 text-lg leading-9 text-[var(--birthday-muted)]">
        <p>這裡之後會放你真正想寫給安的內容。</p>

        <p>現在先保留這一章的位置。</p>
      </div>
    </div>
  );
}
