"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { useTranslations } from "next-intl";

function setThemeCookie(theme: string) {
  document.cookie = `theme=${theme}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax; Secure`;
}

function getInitialTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  const stored = localStorage.getItem("theme") as "light" | "dark" | null;
  if (stored) return stored;
  if (document.documentElement.classList.contains("dark")) return "dark";
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

export default function AdminThemeToggle() {
  const tA = useTranslations("A11y");
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    setThemeCookie(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;
  };

  if (!mounted) {
    return <button className="p-2 w-9 h-9 shrink-0" aria-label="Toggle theme" />;
  }

  return (
    <button
      onClick={toggle}
      className="p-2 shrink-0 transition-colors hover:opacity-80"
      style={{ color: "rgba(255,255,255,0.60)" }}
      aria-label={theme === "light" ? tA("switchToDark") : tA("switchToLight")}
      title={theme === "light" ? tA("switchToDark") : tA("switchToLight")}
    >
      {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
