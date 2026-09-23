export const siteConfig = {
  name: "An & Yao",
  description: "Our little place on the internet.",

  timeZone: "Asia/Taipei",
  relationship: {
    startedAt: "2026-06-06",
  },
  birthday: {
    month: 10,
    day: 29,
  },
  space: {
    name: "An & Yao",
    slug: "an-and-yao",
  },
  navigation: [
    {
      label: "Home",
      href: "/",
    },
    {
      label: "Dates",
      href: "/dates",
    },
    {
      label: "Eat",
      href: "/eat",
    },
    {
      label: "Places",
      href: "/places",
    },
    {
      label: "Memories",
      href: "/memories",
    },
    {
      label: "Journal",
      href: "/journal",
    },
  ],
} as const;
