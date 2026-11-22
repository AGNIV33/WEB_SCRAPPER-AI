"use client";

/**
 * Skeuomorphic light/dark toggle (inspired by the "Dark Mode Toggle" Dribbble shot the user shared):
 * a brushed-metal pill with an engraved crescent. Light mode = silver pill, dark engraved moon.
 * Dark mode = deep navy pill, the moon lights up pale blue and glows. Styles live in globals.css (.tt-*).
 */
export default function ThemeToggle({ onToggle, className = "" }: { onToggle: () => void; className?: string }) {
  return (
    <button type="button" onClick={onToggle} aria-label="Toggle light/dark theme" title="Light / dark" className={`tt ${className}`}>
      <span className="tt-sheen" aria-hidden />
      <svg viewBox="0 0 24 24" className="tt-moon" aria-hidden>
        <path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5a8.6 8.6 0 1 0 10.7 10.7z" />
      </svg>
    </button>
  );
}
