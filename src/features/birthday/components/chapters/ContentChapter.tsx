type ContentChapterProps = {
  eyebrow?: string;
  title: string;
  body?: string;
};

export default function ContentChapter({
  eyebrow,
  title,
  body,
}: ContentChapterProps) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      {eyebrow && (
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--birthday-accent)]">
          {eyebrow}
        </p>
      )}

      <h1 className="font-story mt-8 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
        {title}
      </h1>

      {body && (
        <p className="mx-auto mt-8 max-w-xl whitespace-pre-line text-base leading-8 text-[var(--birthday-muted)] sm:text-lg">
          {body}
        </p>
      )}
    </div>
  );
}
