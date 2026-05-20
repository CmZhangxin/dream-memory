"use client";

import { useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark" | "system";

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "dark") {
    root.classList.add("dark");
  } else if (t === "light") {
    root.classList.remove("dark");
  } else {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const saved = localStorage.getItem("dream-theme") as Theme | null;
    const initial = saved || "dark";
    setTheme(initial);
    applyTheme(initial);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      const current = localStorage.getItem("dream-theme") as Theme | null;
      if (!current || current === "system") {
        applyTheme("system");
      }
    };
    mq.addEventListener("change", handleSystemChange);
    return () => mq.removeEventListener("change", handleSystemChange);
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
    localStorage.setItem("dream-theme", next);
    applyTheme(next);
  }, [theme]);

  return (
    <button
      onClick={toggle}
      className="relative w-8 h-8 rounded-lg flex items-center justify-center
        border border-[--border-color] bg-[--bg-card] text-[--text-secondary]
        hover:bg-[--bg-card-hover] hover:text-[--text-primary] hover:border-[--accent-blue]
        transition-all duration-200 shadow-sm hover:shadow-md"
      title={`主题: ${theme === "light" ? "亮色" : theme === "dark" ? "暗色" : "跟随系统"}`}
    >
      {theme === "light" && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
      )}
      {theme === "dark" && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
      {theme === "system" && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      )}
    </button>
  );
}
