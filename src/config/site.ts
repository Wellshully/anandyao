export const siteConfig = {
  name: "An & Yao",
  description: "Our little place on the internet.",

  timeZone: "Asia/Taipei",

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
      label: "Memories",
      href: "/memories",
    },
    {
      label: "Places",
      href: "/places",
    },
    {
      label: "Eat",
      href: "/eat",
    },
    {
      label: "Calendar",
      href: "/calendar",
    },
    {
      label: "Journal",
      href: "/journal",
    },
  ],
} as const;
