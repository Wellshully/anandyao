import ContentChapter from "@/features/birthday/components/chapters/ContentChapter";

import ChoiceInteraction from "@/features/birthday/components/interactions/ChoiceInteraction";
import FlipCardsInteraction from "@/features/birthday/components/interactions/FlipCardsInteraction";
import PhotoChoiceInteraction from "@/features/birthday/components/interactions/PhotoChoiceInteraction";
import RevealInteraction from "@/features/birthday/components/interactions/RevealInteraction";
import TextInteraction from "@/features/birthday/components/interactions/TextInteraction";
import TimelineOrderInteraction from "@/features/birthday/components/interactions/TimelineOrderInteraction";
import YesNoInteraction from "@/features/birthday/components/interactions/YesNoInteraction";

import type {
  BirthdayAnswer,
  BirthdayChapter,
} from "@/features/birthday/types/story";

type ChapterRendererProps = {
  chapter: BirthdayChapter;

  answer?: BirthdayAnswer;

  onAnswer: (answer: BirthdayAnswer) => void;
};

export default function ChapterRenderer({
  chapter,
  answer,
  onAnswer,
}: ChapterRendererProps) {
  switch (chapter.type) {
    case "content":
      return (
        <ContentChapter
          eyebrow={chapter.eyebrow}
          title={chapter.title}
          body={chapter.body}
        />
      );

    case "choice":
      return (
        <ChoiceInteraction
          question={chapter.question}
          options={chapter.options}
          value={typeof answer === "string" ? answer : undefined}
          correctAnswer={chapter.correctAnswer}
          feedback={chapter.feedback}
          onChange={onAnswer}
        />
      );

    case "photo-choice":
      return (
        <PhotoChoiceInteraction
          question={chapter.question}
          options={chapter.options}
          value={typeof answer === "string" ? answer : undefined}
          correctAnswer={chapter.correctAnswer}
          feedback={chapter.feedback}
          onChange={onAnswer}
        />
      );

    case "text":
      return (
        <TextInteraction
          question={chapter.question}
          placeholder={chapter.placeholder}
          value={typeof answer === "string" ? answer : ""}
          onChange={onAnswer}
        />
      );

    case "yes-no":
      return (
        <YesNoInteraction
          question={chapter.question}
          yesLabel={chapter.yesLabel}
          noLabel={chapter.noLabel}
          value={typeof answer === "boolean" ? answer : undefined}
          correctAnswer={chapter.correctAnswer}
          feedback={chapter.feedback}
          onChange={onAnswer}
        />
      );

    case "reveal":
      return (
        <RevealInteraction
          prompt={chapter.prompt}
          revealLabel={chapter.revealLabel}
          title={chapter.title}
          body={chapter.body}
          imageSrc={chapter.imageSrc}
          imageAlt={chapter.imageAlt}
          revealed={answer === true}
          onReveal={() => onAnswer(true)}
        />
      );

    case "flip-cards":
      return (
        <FlipCardsInteraction
          title={chapter.title}
          description={chapter.description}
          cards={chapter.cards}
          revealedIds={Array.isArray(answer) ? answer : []}
          onChange={onAnswer}
        />
      );

    case "timeline-order":
      return (
        <TimelineOrderInteraction
          question={chapter.question}
          items={chapter.items}
          correctOrder={chapter.correctOrder}
          feedback={chapter.feedback}
          value={Array.isArray(answer) ? answer : undefined}
          onChange={onAnswer}
        />
      );
  }
}
