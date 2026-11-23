"use client";

import { Moon, Sun } from "lucide-react";

/**
 * Light/dark switch: a pill with a sun and a moon. The active side sits in a violet circle
 * (sun in light mode, moon in dark mode). Styles live in globals.css (.tt-seg).
 */
export default function ThemeToggle({ onToggle, className = "" }: { onToggle: () => void; className?: string }) {
  return (
    <button type="button" onClick={onToggle} aria-label="Toggle light/dark theme" title="Light / dark" className={`tt-seg ${className}`}>
      <span className="tt-seg-knob" aria-hidden />
      <Sun size={18} strokeWidth={2.2} className="tt-seg-sun" aria-hidden />
      <Moon size={18} strokeWidth={2.2} className="tt-seg-moon" aria-hidden />
    </button>
  );
}
