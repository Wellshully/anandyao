export const THEME_IDS = [
  "system",
  "an-yao",
  "sakura",
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
};

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
    },
    {
      id: "sakura",
      name: "Sakura",
      description: "柔和的櫻花粉色調",
      colors: [
        "#fff7f9",
        "#fffefe",
        "#d96c8a",
      ],
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
    },
  ];

export function isThemeId(
  value: string | null,
): value is ThemeId {
  return THEME_IDS.includes(
    value as ThemeId,
  );
}
