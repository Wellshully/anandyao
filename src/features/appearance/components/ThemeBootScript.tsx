import {
  SYSTEM_DARK_BROWSER_COLOR,
  THEMES,
  THEME_IDS,
} from "@/features/appearance/config/themes";

const validThemes =
  JSON.stringify(THEME_IDS);

const browserColors = JSON.stringify(
  Object.fromEntries(
    THEMES.map((theme) => [
      theme.id,
      theme.browserColor,
    ]),
  ),
);

const themeBootScript = `
(function () {
  try {
    var key = "anandyao-theme";

    var valid =
      ${validThemes};

    var browserColors =
      ${browserColors};

    var value =
      window.localStorage.getItem(key);

    /*
     * Migrate the old Sakura preference.
     */
    if (value === "sakura") {
      value = "strawberry-milk";

      window.localStorage.setItem(
        key,
        value
      );
    }

    var theme =
      value &&
      valid.indexOf(value) !== -1
        ? value
        : "an-yao";

    document.documentElement.dataset.theme =
      theme;

    var prefersDark =
      window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;

    var browserColor =
      theme === "system"
        ? (
            prefersDark
              ? "${SYSTEM_DARK_BROWSER_COLOR}"
              : "#f8f6f1"
          )
        : (
            browserColors[theme] ||
            "#f8f6f1"
          );

    var meta =
      document.querySelector(
        'meta[name="theme-color"]'
      );

    if (!meta) {
      meta =
        document.createElement("meta");

      meta.setAttribute(
        "name",
        "theme-color"
      );

      document.head.appendChild(meta);
    }

    meta.setAttribute(
      "content",
      browserColor
    );
  } catch (_) {
    document.documentElement.dataset.theme =
      "an-yao";
  }
})();
`;

export default function ThemeBootScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: themeBootScript,
      }}
    />
  );
}
