import type { ReactNode } from 'react';

/** Just enough markdown for an answer: paragraphs, **bold**, `code`, - and 1. lists, and ### headings. Nothing is injected as HTML. */
function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((p, i) =>
    p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p.startsWith('`') ? <code key={i} className="rounded bg-surface2 px-1 py-0.5 text-[13px]">{p.slice(1, -1)}</code> : <span key={i}>{p}</span>);
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => { if (para.length) { blocks.push(<p key={blocks.length}>{inline(para.join(' '))}</p>); para = []; } };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(<Tag key={blocks.length} className={list.ordered ? 'list-decimal' : 'list-disc'}>{list.items.map((it, i) => <li key={i}>{inline(it)}</li>)}</Tag>);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const b = line.match(/^\s*[-*]\s+(.*)$/); const n = line.match(/^\s*\d+[.)]\s+(.*)$/); const h = line.match(/^#{1,4}\s+(.*)$/);
    if (b || n) {
      flushPara();
      const ordered = !!n;
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; }
      list.items.push((b ?? n)![1]);
    } else if (h) { flushPara(); flushList(); blocks.push(<h4 key={blocks.length}>{inline(h[1])}</h4>); }
    else if (!line.trim()) { flushPara(); flushList(); }
    else { flushList(); para.push(line.trim()); }
  }
  flushPara(); flushList();
  return <div className="prose-answer">{blocks}</div>;
}
