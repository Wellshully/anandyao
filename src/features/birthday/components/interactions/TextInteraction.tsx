"use client";

type TextInteractionProps = {
  question: string;

  placeholder?: string;

  value?: string;

  onChange: (value: string) => void;
};

export default function TextInteraction({
  question,
  placeholder,
  value = "",
  onChange,
}: TextInteractionProps) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <h2 className="font-story text-3xl font-semibold leading-tight sm:text-5xl">
        {question}
      </h2>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={5}
        className="
          mt-10
          w-full
          resize-none
          rounded-2xl
          border
          border-white/10
          bg-white/[0.04]
          px-5
          py-4
          text-base
          leading-7
          text-[var(--birthday-foreground)]
          outline-none
          transition
          placeholder:text-[var(--birthday-muted)]
          focus:border-[var(--birthday-accent)]
        "
      />

      <p className="mt-3 text-xs text-[var(--birthday-muted)]">
        沒有標準答案。
      </p>
    </div>
  );
}
