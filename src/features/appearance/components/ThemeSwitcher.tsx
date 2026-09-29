"use client";

import {
  useSyncExternalStore,
} from "react";

import {
  getThemeBrowserColor,
  isThemeId,
  THEMES,
  type ThemeId,
} from "@/features/appearance/config/themes";

const STORAGE_KEY = "anandyao-theme";

const THEME_CHANGE_EVENT =
  "anandyao-theme-change";

function getThemeSnapshot(): ThemeId {
  const current =
    document.documentElement.dataset.theme;

  if (
    current &&
    isThemeId(current)
  ) {
    return current;
  }

  return "an-yao";
}

function getServerSnapshot(): ThemeId {
  return "an-yao";
}

function subscribe(
  callback: () => void,
) {
  window.addEventListener(
    THEME_CHANGE_EVENT,
    callback,
  );

  return () => {
    window.removeEventListener(
      THEME_CHANGE_EVENT,
      callback,
    );
  };
}

function updateBrowserThemeColor(
  theme: ThemeId,
) {
  const prefersDark =
    window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;

  const color =
    getThemeBrowserColor(
      theme,
      prefersDark,
    );

  /*
   * WebKit uses the first valid theme-color
   * meta element.
   *
   * Remove old copies and prepend a fresh one
   * so Safari cannot keep reading a stale
   * Next.js-generated element.
   */
  document
    .querySelectorAll(
      'meta[name="theme-color"]',
    )
    .forEach((element) => {
      element.remove();
    });

  const meta =
    document.createElement("meta");

  meta.name = "theme-color";
  meta.content = color;

  document.head.prepend(meta);

  /*
   * Safari 26 also derives surrounding browser
   * chrome from the page background in some
   * situations, so update these synchronously.
   */
}

function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme =
    theme;

  window.localStorage.setItem(
    STORAGE_KEY,
    theme,
  );

  updateBrowserThemeColor(theme);

  window.dispatchEvent(
    new Event(THEME_CHANGE_EVENT),
  );
}

type ThemeSwitcherProps = {
  compact?: boolean;
};

export default function ThemeSwitcher({
  compact = false,
}: ThemeSwitcherProps) {
  const theme = useSyncExternalStore(
    subscribe,
    getThemeSnapshot,
    getServerSnapshot,
  );

  if (compact) {
    return (
      <div
        className="
          max-h-72
          space-y-1.5
          overflow-y-auto
          overscroll-contain
          pr-1
        "
      >
        {THEMES.map((option) => {
          const selected =
            option.id === theme;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() =>
                applyTheme(option.id)
              }
              aria-pressed={selected}
              className={`
                flex
                w-full
                items-center
                gap-3
                rounded-xl
                border
                px-3
                py-2.5
                text-left
                transition

                ${
                  selected
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-transparent hover:bg-[var(--surface-soft)]"
                }
              `}
            >
              <div className="flex shrink-0 -space-x-1">
                {option.colors.map(
                  (
                    color,
                    index,
                  ) => (
                    <span
                      key={`${option.id}-${index}`}
                      className="
                        h-4
                        w-4
                        rounded-full
                        border
                        border-black/10
                      "
                      style={{
                        backgroundColor:
                          color,
                      }}
                    />
                  ),
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">
                  {option.name}
                </p>

                <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">
                  {
                    option.description
                  }
                </p>
              </div>

              <span
                className={`
                  shrink-0
                  text-xs
                  text-[var(--accent)]

                  ${
                    selected
                      ? "opacity-100"
                      : "opacity-0"
                  }
                `}
                aria-hidden="true"
              >
                ✓
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {THEMES.map((option) => {
        const selected =
          option.id === theme;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() =>
              applyTheme(option.id)
            }
            aria-pressed={selected}
            className={`
              group
              rounded-2xl
              border
              p-4
              text-left
              transition
              hover:-translate-y-0.5

              ${
                selected
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--foreground)]"
              }
            `}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex -space-x-1">
                {option.colors.map(
                  (
                    color,
                    index,
                  ) => (
                    <span
                      key={`${option.id}-${index}`}
                      className="
                        h-5
                        w-5
                        rounded-full
                        border
                        border-black/10
                      "
                      style={{
                        backgroundColor:
                          color,
                      }}
                    />
                  ),
                )}
              </div>

              {selected && (
                <span className="text-xs font-medium text-[var(--accent)]">
                  ✓
                </span>
              )}
            </div>

            <p className="mt-4 text-sm font-medium">
              {option.name}
            </p>

            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              {
                option.description
              }
            </p>
          </button>
        );
      })}
    </div>
  );
}
