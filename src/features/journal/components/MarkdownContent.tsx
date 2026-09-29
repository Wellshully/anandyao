import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownContentProps = {
  content: string;
};

export default function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="space-y-4 leading-7 text-[var(--foreground)]">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-8 text-3xl font-semibold text-[var(--foreground)]">
              {children}
            </h1>
          ),

          h2: ({ children }) => (
            <h2 className="mt-8 text-2xl font-semibold text-[var(--foreground)]">
              {children}
            </h2>
          ),

          h3: ({ children }) => (
            <h3 className="mt-6 text-xl font-semibold text-[var(--foreground)]">
              {children}
            </h3>
          ),

          p: ({ children }) => <p>{children}</p>,

          ul: ({ children }) => (
            <ul className="ml-6 list-disc space-y-1">{children}</ul>
          ),

          ol: ({ children }) => (
            <ol className="ml-6 list-decimal space-y-1">{children}</ol>
          ),

          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[var(--border)] pl-4 text-[var(--muted)]">
              {children}
            </blockquote>
          ),

          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              {children}
            </a>
          ),

          code: ({ children }) => (
            <code className="rounded bg-[var(--surface-soft)] px-1.5 py-0.5 font-mono text-sm">
              {children}
            </code>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
