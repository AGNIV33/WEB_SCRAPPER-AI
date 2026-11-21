"use client";

import { memo, useEffect, useState } from "react";

/** Shrinks a big screenshot to a tiny image. Scaled back up by CSS it looks blurred, for almost no GPU cost
 *  (a live CSS `filter: blur()` on full-size screenshots behind many glass panels was the main source of lag). */
function tinyThumb(src: string, width = 48): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const h = Math.max(1, Math.round((img.height / img.width) * width));
      const c = document.createElement("canvas");
      c.width = width; c.height = Math.min(h, width * 2);
      c.getContext("2d")!.drawImage(img, 0, 0, img.width, Math.min(img.height, img.width * 2), 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => resolve("");
    img.src = src;
  });
}

/**
 * Glass mode background: the analysed site's own look (screenshots + palette) behind frosted panels.
 * Without a site, shows a default gradient mesh.
 */
function SiteBackground({ shots, colors, blur, strength }: { shots: string[]; colors: string[]; blur: number; strength: number }) {
  const [thumbs, setThumbs] = useState<string[]>([]);
  const key = shots.slice(0, 6).map((s) => s.length).join(",") + "|" + blur;

  useEffect(() => {
    let live = true;
    // more blur = smaller thumbnail
    const w = Math.max(16, Math.round(96 - blur * 2));
    Promise.all(shots.slice(0, 6).map((s) => tinyThumb(s, w))).then((t) => { if (live) setThumbs(t.filter(Boolean)); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const c = colors.length ? colors : ["#8b5cf6", "#6366f1", "#38bdf8", "#f472b6"];
  const mesh = [
    `radial-gradient(40% 50% at 12% 18%, ${c[0]}cc, transparent 70%)`,
    `radial-gradient(45% 55% at 88% 22%, ${c[1 % c.length]}cc, transparent 70%)`,
    `radial-gradient(50% 50% at 75% 88%, ${c[2 % c.length]}cc, transparent 70%)`,
    `radial-gradient(45% 45% at 18% 85%, ${c[3 % c.length]}cc, transparent 70%)`,
  ].join(", ");
  const o = strength / 100;
  const shown = shots.length ? thumbs : [];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-0 overflow-hidden" style={{ contain: "strict" }}>
      <div className="absolute inset-0" style={{ background: mesh, opacity: o }} />
      {shown.length > 0 && (
        <div className="absolute inset-[-40px] grid grid-cols-2 gap-6 p-6 md:grid-cols-3" style={{ opacity: o * 0.85 }}>
          {shown.map((src, i) => (
            <div key={i} className="h-full max-h-[70vh] w-full rounded-3xl bg-cover bg-top"
              style={{ backgroundImage: `url(${src})`, transform: `rotate(${(i % 2 ? 1 : -1) * (2 + i)}deg) translateY(${(i % 3) * 30}px)` }} />
          ))}
        </div>
      )}
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:22px_22px]" />
    </div>
  );
}

export default memo(SiteBackground);
