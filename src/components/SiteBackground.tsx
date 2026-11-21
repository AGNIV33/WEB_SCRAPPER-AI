"use client";
/* eslint-disable @next/next/no-img-element */

/**
 * Glass mode background: the analysed site's own look (screenshots + palette) behind frosted panels.
 * Without a site, shows a default purple gradient mesh.
 */
export default function SiteBackground({ shots, colors, blur, strength }: { shots: string[]; colors: string[]; blur: number; strength: number }) {
  const c = colors.length ? colors : ["#8b5cf6", "#6366f1", "#38bdf8", "#f472b6"];
  const mesh = [
    `radial-gradient(40% 50% at 12% 18%, ${c[0]}cc, transparent 70%)`,
    `radial-gradient(45% 55% at 88% 22%, ${c[1 % c.length]}cc, transparent 70%)`,
    `radial-gradient(50% 50% at 75% 88%, ${c[2 % c.length]}cc, transparent 70%)`,
    `radial-gradient(45% 45% at 18% 85%, ${c[3 % c.length]}cc, transparent 70%)`,
  ].join(", ");
  const o = strength / 100;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
      <div className="absolute inset-0 transition-[background] duration-700" style={{ background: mesh, opacity: o }} />
      {shots.length > 0 && (
        <div className="absolute inset-[-40px] grid grid-cols-2 gap-6 p-6 md:grid-cols-3" style={{ filter: `blur(${blur}px) saturate(1.3)`, opacity: o * 0.85 }}>
          {shots.slice(0, 6).map((src, i) => (
            <img key={i} src={src} alt="" className="h-full max-h-[70vh] w-full rounded-3xl object-cover object-top"
              style={{ transform: `rotate(${(i % 2 ? 1 : -1) * (2 + i)}deg) translateY(${(i % 3) * 30}px)` }} />
          ))}
        </div>
      )}
      {/* subtle dot pattern for texture */}
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:22px_22px]" />
    </div>
  );
}
