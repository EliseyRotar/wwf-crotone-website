"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    if (stored) {
      setTheme(stored);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;
  };

  // Prevent hydration mismatch — render a placeholder until mounted
  if (!mounted) {
    return <button className="p-2 w-9 h-9 shrink-0" aria-label="Toggle theme" />;
  }

  return (
    <button
      onClick={toggle}
      className="p-2 text-ink hover:text-wwf-green shrink-0 transition-colors"
      aria-label={theme === "light" ? "Passa al tema scuro" : "Passa al tema chiaro"}
      title={theme === "light" ? "Tema scuro" : "Tema chiaro"}
    >
      {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}