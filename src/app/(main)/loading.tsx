export default function MainLoading() {
  return (
    <div
      className="
        flex
        min-h-[60vh]
        items-center
        justify-center
        px-6
      "
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <div
          className="
            mx-auto
            h-6
            w-6
            animate-spin
            rounded-full
            border-2
            border-[var(--border)]
            border-t-[var(--foreground)]
          "
          aria-hidden="true"
        />

        <p className="mt-4 text-sm text-[var(--muted)]">載入中…</p>
      </div>
    </div>
  );
}
