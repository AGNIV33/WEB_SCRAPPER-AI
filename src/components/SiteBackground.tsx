"use client";

import { memo, useEffect, useState } from "react";

/**
 * Prepares ONE good-quality background from the homepage screenshot: the top (landing) part only,
 * blurred once on a canvas. The result is a static image, so scrolling costs nothing
 * (a live CSS blur over the page was a main cause of lag).
 */
function prepare(src: string, blur: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.width, h = Math.min(img.height, Math.round(w * 0.7)); // landing area (above the fold)
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d")!;
      if (blur > 0) {
        ctx.filter = `blur(${blur}px)`;
        // draw slightly larger so blurred edges don't fade to transparent
        ctx.drawImage(img, 0, 0, w, h, -blur * 2, -blur * 2, w + blur * 4, h + blur * 4);
      } else ctx.drawImage(img, 0, 0, w, h, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => resolve("");
    img.src = src;
  });
}

function SiteBackground({ shot, blur, strength }: { shot: string | null; blur: number; strength: number }) {
  const [bg, setBg] = useState<{ src: string; for: string } | null>(null);
  const id = shot ? `${shot.length}:${blur}` : "";

  useEffect(() => {
    if (!shot) return;
    let live = true;
    prepare(shot, blur).then((src) => { if (live) setBg({ src, for: id }); });
    return () => { live = false; };
  }, [shot, blur, id]);

  const o = strength / 100;
  const ready = shot && bg && bg.for === id && bg.src;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-0 overflow-hidden" style={{ contain: "strict" }}>
      {/* colour glow from the site's accents (always) */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(45% 50% at 12% 15%, var(--app-glow-1, #8b5cf6), transparent 70%), radial-gradient(45% 55% at 88% 85%, var(--app-glow-2, #38bdf8), transparent 70%)", opacity: o * 0.55 }} />
      {ready && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bg.src} alt="" className="absolute inset-0 h-full w-full object-cover object-top" style={{ opacity: o }} />
      )}
    </div>
  );
}

export default memo(SiteBackground);
