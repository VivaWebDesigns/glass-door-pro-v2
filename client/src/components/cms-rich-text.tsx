import type { ReactNode } from "react";
import { safeCmsHref } from "@/lib/cms-safety";
import { cn } from "@/lib/utils";

const richTextTypeStyle = (token: "h2" | "h3" | "body", fallback: string) => ({
  fontSize: `var(--cms-type-${token}, ${fallback})`,
});

type CmsRichTextProps = {
  body: string;
  className?: string;
  paragraphClassName?: string;
  headingClassName?: string;
  subheadingClassName?: string;
  smallHeadingClassName?: string;
  listClassName?: string;
  numberedListClassName?: string;
  quoteClassName?: string;
  linkClassName?: string;
};

const renderInlineContent = (text: string, keyPrefix: string, linkClassName?: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const linkPattern = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const label = match[1].trim();
    const href = safeCmsHref(match[2]);
    nodes.push(
      href ? (
        <a
          key={`${keyPrefix}-${match.index}`}
          href={href}
          className={cn("font-semibold text-primary underline-offset-4 hover:underline", linkClassName)}
        >
          {label}
        </a>
      ) : (
        match[0]
      ),
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};

export function CmsRichText({
  body,
  className,
  paragraphClassName,
  headingClassName,
  subheadingClassName,
  smallHeadingClassName,
  listClassName,
  numberedListClassName,
  quoteClassName,
  linkClassName,
}: CmsRichTextProps) {
  const lines = body.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let bulletItems: string[] = [];
  let numberedItems: string[] = [];
  let quoteItems: string[] = [];

  const paragraphClasses = cn("leading-8 text-slate-700", paragraphClassName);
  const listClasses = cn("list-disc space-y-2 pl-6 leading-8 text-slate-700", listClassName);
  const numberedListClasses = cn("list-decimal space-y-2 pl-6 leading-8 text-slate-700", numberedListClassName);
  const quoteClasses = cn("border-l-4 border-primary/70 pl-5 text-lg leading-8 text-slate-700", quoteClassName);
  const h2Classes = cn("pt-5 text-3xl font-bold leading-tight text-slate-950", headingClassName);
  const h3Classes = cn("pt-5 text-2xl font-bold leading-tight text-slate-950", subheadingClassName);
  const h4Classes = cn("pt-4 text-xl font-bold leading-tight text-slate-950", smallHeadingClassName);

  const flushParagraph = (index: number) => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").replace(/\s+/g, " ").trim();
    if (text) {
      blocks.push(
        <p key={`p-${index}`} className={paragraphClasses} style={richTextTypeStyle("body", "1rem")}>
          {renderInlineContent(text, `p-${index}`, linkClassName)}
        </p>,
      );
    }
    paragraph = [];
  };

  const flushBulletList = (index: number) => {
    if (!bulletItems.length) return;
    blocks.push(
      <ul key={`ul-${index}`} className={listClasses} style={richTextTypeStyle("body", "1rem")}>
        {bulletItems.map((item, itemIndex) => (
          <li key={`${index}-${itemIndex}`}>{renderInlineContent(item, `ul-${index}-${itemIndex}`, linkClassName)}</li>
        ))}
      </ul>,
    );
    bulletItems = [];
  };

  const flushNumberedList = (index: number) => {
    if (!numberedItems.length) return;
    blocks.push(
      <ol key={`ol-${index}`} className={numberedListClasses} style={richTextTypeStyle("body", "1rem")}>
        {numberedItems.map((item, itemIndex) => (
          <li key={`${index}-${itemIndex}`}>{renderInlineContent(item, `ol-${index}-${itemIndex}`, linkClassName)}</li>
        ))}
      </ol>,
    );
    numberedItems = [];
  };

  const flushQuote = (index: number) => {
    if (!quoteItems.length) return;
    const text = quoteItems.join(" ").replace(/\s+/g, " ").trim();
    blocks.push(
      <blockquote key={`quote-${index}`} className={quoteClasses} style={richTextTypeStyle("body", "1rem")}>
        {renderInlineContent(text, `quote-${index}`, linkClassName)}
      </blockquote>,
    );
    quoteItems = [];
  };

  const flushInlineBlocks = (index: number) => {
    flushParagraph(index);
    flushBulletList(index);
    flushNumberedList(index);
    flushQuote(index);
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushInlineBlocks(index);
      return;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      flushInlineBlocks(index);
      const content = renderInlineContent(headingMatch[2].trim(), `h-${index}`, linkClassName);
      if (headingMatch[1].length === 1) {
        blocks.push(<h2 key={`h-${index}`} className={h2Classes} style={richTextTypeStyle("h2", "2.25rem")}>{content}</h2>);
      } else if (headingMatch[1].length === 2) {
        blocks.push(<h3 key={`h-${index}`} className={h3Classes} style={richTextTypeStyle("h3", "1.5rem")}>{content}</h3>);
      } else {
        blocks.push(<h4 key={`h-${index}`} className={h4Classes} style={richTextTypeStyle("h3", "1.5rem")}>{content}</h4>);
      }
      return;
    }

    const bulletMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    if (bulletMatch) {
      flushParagraph(index);
      flushNumberedList(index);
      flushQuote(index);
      bulletItems.push(bulletMatch[1].trim());
      return;
    }

    const numberedMatch = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (numberedMatch) {
      flushParagraph(index);
      flushBulletList(index);
      flushQuote(index);
      numberedItems.push(numberedMatch[1].trim());
      return;
    }

    const quoteMatch = /^>\s+(.+)$/.exec(trimmed);
    if (quoteMatch) {
      flushParagraph(index);
      flushBulletList(index);
      flushNumberedList(index);
      quoteItems.push(quoteMatch[1].trim());
      return;
    }

    flushBulletList(index);
    flushNumberedList(index);
    flushQuote(index);
    paragraph.push(trimmed);
  });

  flushInlineBlocks(lines.length);

  return <div className={cn("space-y-6", className)}>{blocks}</div>;
}
