import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",

    name: "An & Yao",

    short_name: "An & Yao",

    description: "Our little place.",

    start_url: "/",

    scope: "/",

    display: "standalone",

    background_color: "#f8f6f1",

    theme_color: "#f8f6f1",

    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
