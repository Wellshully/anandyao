import {
  THEME_IDS,
} from "@/features/appearance/config/themes";

const validThemes =
  JSON.stringify(THEME_IDS);

const themeBootScript = `
(function () {
  try {
    var key = "anandyao-theme";

    var valid =
      ${validThemes};

    var value =
      window.localStorage.getItem(key);

    var theme =
      value &&
      valid.indexOf(value) !== -1
        ? value
        : "an-yao";

    document.documentElement.dataset.theme =
      theme;
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
