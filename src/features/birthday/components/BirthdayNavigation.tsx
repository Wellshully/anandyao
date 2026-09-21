type BirthdayNavigationProps = {
  current: number;
  total: number;
  canContinue: boolean;

  onNext: () => void;
  onPrevious: () => void;
};

export default function BirthdayNavigation({
  current,
  total,
  canContinue,
  onNext,
  onPrevious,
}: BirthdayNavigationProps) {
  const isFirst = current === 0;
  const isLast = current === total - 1;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        {Array.from({
          length: total,
        }).map((_, index) => (
          <div
            key={index}
            className={`
              h-1 rounded-full transition-all duration-500
              ${
                index === current
                  ? "w-8 bg-[var(--birthday-foreground)]"
                  : "w-2 bg-white/20"
              }
            `}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        {!isFirst && (
          <button
            type="button"
            onClick={onPrevious}
            className="
              rounded-full
              border
              border-white/10
              px-4
              py-2
              text-sm
              text-[var(--birthday-muted)]
              transition
              hover:border-white/20
              hover:text-[var(--birthday-foreground)]
            "
          >
            ←
          </button>
        )}

        {!isLast && (
          <button
            type="button"
            disabled={!canContinue}
            onClick={onNext}
            className="
              rounded-full
              bg-[var(--birthday-foreground)]
              px-5
              py-2
              text-sm
              font-medium
              text-[var(--birthday-background)]
              transition
              hover:opacity-90
              disabled:cursor-not-allowed
              disabled:opacity-25
            "
          >
            繼續
          </button>
        )}
      </div>
    </div>
  );
}
