export const THEME_IDS = [
  "system",
  "an-yao",
  "strawberry-milk",
  "thistle",
  "crystal-glass",
  "dark",
  "mocha",
  "tokyo-night",
  "nord",
] as const;

export type ThemeId =
  (typeof THEME_IDS)[number];

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  description: string;
  colors: readonly string[];
  browserColor: string;
};

export const SYSTEM_DARK_BROWSER_COLOR =
  "#111315";

export const THEMES: readonly ThemeDefinition[] =
  [
    {
      id: "system",
      name: "System",
      description: "跟隨裝置外觀",
      colors: [
        "#f8f6f1",
        "#111315",
      ],
      browserColor: "#f8f6f1",
    },
    {
      id: "an-yao",
      name: "An & Yao",
      description: "原本的暖色調",
      colors: [
        "#f8f6f1",
        "#fffdf9",
        "#a85f68",
      ],
      browserColor: "#f8f6f1",
    },
    {
      id: "strawberry-milk",
      name: "Strawberry Milk",
      description: "甜一點的草莓牛奶粉",
      colors: [
        "#fff0f5",
        "#ffe1ea",
        "#df4775",
      ],
      browserColor: "#fff0f5",
    },
    {
      id: "thistle",
      name: "Thistle",
      description: "柔和的灰粉紫色調",
      colors: [
        "#ecdfe6",
        "#d9bfcc",
        "#814b67",
      ],
      browserColor: "#ecdfe6",
    },
    {
      id: "crystal-glass",
      name: "Crystal Glass",
      description: "深色琉璃、午夜藍紫與銀色晶體高光",
      colors: [
        "#0d1020",
        "#242944",
        "#435a87",
        "#c4a9f7",
      ],
      browserColor: "#0d1020",
    },
    {
      id: "dark",
      name: "Dark",
      description: "簡單的深色模式",
      colors: [
        "#111315",
        "#191c20",
        "#d9a39a",
      ],
      browserColor: "#111315",
    },
    {
      id: "mocha",
      name: "Mocha",
      description: "溫暖的咖啡紫色調",
      colors: [
        "#1e1e2e",
        "#313244",
        "#cba6f7",
      ],
      browserColor: "#1e1e2e",
    },
    {
      id: "tokyo-night",
      name: "Tokyo Night",
      description: "深藍與夜間冷色調",
      colors: [
        "#1a1b26",
        "#24283b",
        "#7aa2f7",
      ],
      browserColor: "#1a1b26",
    },
    {
      id: "nord",
      name: "Nord",
      description: "冷灰與冰藍色調",
      colors: [
        "#2e3440",
        "#3b4252",
        "#88c0d0",
      ],
      browserColor: "#2e3440",
    },
  ];

export function isThemeId(
  value: string | null,
): value is ThemeId {
  return THEME_IDS.includes(
    value as ThemeId,
  );
}

export function getThemeBrowserColor(
  theme: ThemeId,
  prefersDark: boolean,
) {
  if (theme === "system") {
    return prefersDark
      ? SYSTEM_DARK_BROWSER_COLOR
      : "#f8f6f1";
  }

  return (
    THEMES.find(
      (item) => item.id === theme,
    )?.browserColor ?? "#f8f6f1"
  );
}
