export const siteConfig = {
  name: "An & Yao",
  description: "Our little place on the internet.",

  timeZone: "Asia/Taipei",

  birthday: {
    month: 10,
    day: 29,
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
      label: "Calendar",
      href: "/calendar",
    },
    {
      label: "Journal",
      href: "/journal",
    },
  ],
} as const;
