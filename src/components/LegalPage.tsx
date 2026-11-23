/* Shared layout for the public legal pages (/privacy, /terms, /disclaimer).
 * Plain server component: no data, no tracking. Theme (light/dark) comes from the script in layout.tsx. */
import Link from "next/link";
import type { ReactNode } from "react";

export const EFFECTIVE_DATE = "23 November 2026";
export const OWNER = "Agniv Sarkar";
export const SITE = "Scrapper AI";

const LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Use" },
  { href: "/disclaimer", label: "Disclaimer" },
];

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-8 text-lg font-bold text-slate-900 dark:text-white">{children}</h2>;
}

export function List({ items }: { items: ReactNode[] }) {
  return <ul className="mt-2 list-disc space-y-1.5 pl-5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
}

export const ContactLink = () => <Link href="/?view=contact" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Contact us</Link>;

export default function LegalPage({ title, current, children }: { title: string; current: string; children: ReactNode }) {
  return (
    <div className="waves min-h-screen text-slate-700 dark:text-slate-300">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <header className="flex flex-wrap items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.svg" alt="" className="h-8 w-8" />
            <span className="font-bold"><span className="text-[#1e1b4b] dark:text-white">Scrapper</span> <span className="text-violet-500">AI</span></span>
          </Link>
          <Link href="/" className="ml-auto rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/25">Open the app</Link>
        </header>
        <nav className="mt-6 flex flex-wrap gap-2 text-sm">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={l.href === current ? "page" : undefined}
              className={`rounded-full border px-3 py-1 ${l.href === current ? "border-indigo-400 bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200" : "border-slate-200 bg-white/70 hover:border-indigo-300 dark:border-white/10 dark:bg-white/5"}`}>
              {l.label}
            </Link>
          ))}
        </nav>
        <main className="glass-panel mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed shadow-sm dark:border-white/10 dark:bg-[#16162a] sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Effective date: {EFFECTIVE_DATE}</p>
          {children}
        </main>
        <footer className="mt-6 text-center text-xs text-slate-400">© 2026 {OWNER}. All rights reserved.</footer>
      </div>
    </div>
  );
}
