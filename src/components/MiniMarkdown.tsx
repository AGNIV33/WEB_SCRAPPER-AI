/* Tiny, safe markdown for AI answers: ### headings, "- " bullets, **bold** and `code`. No HTML is injected. */
import React from "react";

function inline(t: string, key: string) {
  return t.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <b key={key + i}>{part.slice(2, -2)}</b>
    : part.startsWith("`") && part.endsWith("`") ? <code key={key + i} className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em] dark:bg-white/10">{part.slice(1, -1)}</code>
    : part);
}

export default function MiniMarkdown({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) { const items = list; out.push(<ul key={`u${out.length}`} className="my-1 list-disc space-y-1 pl-5">{items.map((l, i) => <li key={i}>{inline(l, `l${out.length}-${i}`)}</li>)}</ul>); list = []; } };
  text.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    const b = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (b) { list.push(b[1]); return; }
    flush();
    if (!line) return;
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) out.push(<h4 key={i} className="mb-1 mt-3 font-semibold text-slate-900 first:mt-0 dark:text-white">{inline(h[1], `h${i}`)}</h4>);
    else out.push(<p key={i} className="my-1">{inline(line, `p${i}`)}</p>);
  });
  flush();
  return <div className="text-sm leading-relaxed">{out}</div>;
}
