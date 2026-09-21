export type BirthdayAnswer = string | boolean | string[];

export type BirthdayAnswers = Record<string, BirthdayAnswer>;

export type AnswerFeedback = {
  correct?: string;
  incorrect?: string;
};

export type ChoiceOption = {
  value: string;
  label: string;
};

export type PhotoChoiceOption = {
  value: string;
  src: string;
  alt: string;
  label?: string;
};

export type FlipCardOption = {
  id: string;

  front: string;

  backTitle: string;
  backBody?: string;

  imageSrc?: string;
  imageAlt?: string;
};

export type TimelineItem = {
  id: string;
  title: string;
  description?: string;
};

export type ContentChapter = {
  id: string;
  type: "content";

  eyebrow?: string;
  title: string;
  body?: string;
};

export type ChoiceChapter = {
  id: string;
  type: "choice";

  eyebrow?: string;
  question: string;

  options: ChoiceOption[];

  required?: boolean;

  correctAnswer?: string;
  requireCorrect?: boolean;

  feedback?: AnswerFeedback;
};

export type PhotoChoiceChapter = {
  id: string;
  type: "photo-choice";

  eyebrow?: string;
  question: string;

  options: PhotoChoiceOption[];

  required?: boolean;

  correctAnswer?: string;
  requireCorrect?: boolean;

  feedback?: AnswerFeedback;
};

export type TextChapter = {
  id: string;
  type: "text";

  eyebrow?: string;
  question: string;

  placeholder?: string;

  required?: boolean;
};

export type YesNoChapter = {
  id: string;
  type: "yes-no";

  eyebrow?: string;
  question: string;

  yesLabel?: string;
  noLabel?: string;

  required?: boolean;

  correctAnswer?: boolean;
  requireCorrect?: boolean;

  feedback?: AnswerFeedback;
};

export type RevealChapter = {
  id: string;
  type: "reveal";

  eyebrow?: string;

  prompt: string;
  revealLabel?: string;

  title: string;
  body?: string;

  imageSrc?: string;
  imageAlt?: string;

  required?: boolean;
};

export type FlipCardsChapter = {
  id: string;
  type: "flip-cards";

  eyebrow?: string;
  title: string;
  description?: string;

  cards: FlipCardOption[];

  required?: boolean;
  requireAll?: boolean;
};

export type TimelineOrderChapter = {
  id: string;
  type: "timeline-order";

  eyebrow?: string;
  question: string;

  items: TimelineItem[];

  correctOrder: string[];

  required?: boolean;
  requireCorrect?: boolean;

  feedback?: AnswerFeedback;
};

export type BirthdayChapter =
  | ContentChapter
  | ChoiceChapter
  | PhotoChoiceChapter
  | TextChapter
  | YesNoChapter
  | RevealChapter
  | FlipCardsChapter
  | TimelineOrderChapter;
