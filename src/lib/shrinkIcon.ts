/** Browser only: redraws a logo at 64×64 PNG so big icons (some sites ship 100 KB+) still fit in saved history. */
export function shrinkIcon(src: string, size = 64): Promise<string> {
  if (typeof document === "undefined" || src.length < 8_000) return Promise.resolve(src);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        if (!ctx) return resolve(src);
        const s = Math.min(size / (img.naturalWidth || size), size / (img.naturalHeight || size));
        const w = (img.naturalWidth || size) * s, h = (img.naturalHeight || size) * s;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        const out = c.toDataURL("image/png");
        resolve(out.length < src.length ? out : src);
      } catch { resolve(src); }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}
