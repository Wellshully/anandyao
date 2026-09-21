import type { BirthdayChapter } from "@/features/birthday/types/story";

export const birthdayStory: BirthdayChapter[] = [
  {
    id: "intro",
    type: "content",

    eyebrow: "October 29",

    title: "安，生日快樂。",

    body: "我準備了一些東西，想讓妳慢慢打開。",
  },

  {
    id: "question-one",
    type: "choice",

    eyebrow: "First question",

    question: "如果只能選一個，妳比較想去哪裡？",

    options: [
      {
        value: "mountain",
        label: "山上",
      },
      {
        value: "sea",
        label: "海邊",
      },
      {
        value: "city",
        label: "陌生的城市",
      },
    ],

    required: true,
  },

  {
    id: "little-memories",
    type: "flip-cards",

    eyebrow: "Little things",

    title: "有些小事情，我一直記得。",

    description: "把每一張卡片翻開看看。",

    cards: [
      {
        id: "card-one",

        front: "01",

        backTitle: "第一件事情",

        backBody: "之後這裡可以換成我們真正的回憶。",
      },

      {
        id: "card-two",

        front: "02",

        backTitle: "第二件事情",

        backBody: "這張卡片之後也可以放照片。",
      },

      {
        id: "card-three",

        front: "03",

        backTitle: "第三件事情",

        backBody: "這些內容最後都會換成你的正式腳本。",
      },
    ],

    required: true,

    requireAll: true,
  },

  {
    id: "question-two",
    type: "text",

    eyebrow: "Think about it",

    question: "妳現在第一個想到的回憶是什麼？",

    placeholder: "寫下妳想到的事情...",

    required: true,
  },

  {
    id: "our-timeline",
    type: "timeline-order",

    eyebrow: "Do you remember?",

    question: "妳還記得這些事情發生的順序嗎？",

    items: [
      {
        id: "third",
        title: "第三件事情",
      },

      {
        id: "first",
        title: "第一件事情",
      },

      {
        id: "fourth",
        title: "第四件事情",
      },

      {
        id: "second",
        title: "第二件事情",
      },
    ],

    correctOrder: ["first", "second", "third", "fourth"],

    required: true,

    requireCorrect: true,

    feedback: {
      correct: "答對了，全部都記得。",

      incorrect: "好像有哪幾件事情放反了。",
    },
  },

  {
    id: "question-three",
    type: "yes-no",

    eyebrow: "One more",

    question: "妳覺得妳很了解我嗎？",

    yesLabel: "當然",

    noLabel: "好像還好",

    required: true,
  },

  {
    id: "letter",
    type: "content",

    eyebrow: "A letter",

    title: "有些話，留到這裡再說。",

    body: "這裡之後會放真正寫給妳的內容。",
  },

  {
    id: "ending",
    type: "content",

    eyebrow: "Not the end",

    title: "這裡還沒有結束。",

    body: "因為這個網站，也不是只做到今天。",
  },
];
