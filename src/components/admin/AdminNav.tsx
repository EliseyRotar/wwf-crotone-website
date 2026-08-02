"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { LayoutDashboard, Users, CalendarDays, Image as ImageIcon, LogOut, UserCog, ClipboardList, Menu, X, FileText, Settings, History } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";

export default function AdminNav({ session }: { session: SessionUser }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const t = useTranslations("Admin.nav");
  const tRoles = useTranslations("Admin.roles");
  const tNav = useTranslations("Nav");
  const [mobileOpen, setMobileOpen] = useState(false);

  const isSuper = session.role === "superadmin";

  const links = [
    { href: "/admin", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/admin/iscrizioni", label: t("iscrizioni"), icon: Users },
    { href: "/admin/operatori", label: t("operatori"), icon: Users },
    { href: "/admin/roster", label: t("roster"), icon: ClipboardList },
    { href: "/admin/turni", label: t("campi"), icon: CalendarDays },
    { href: "/admin/gallery", label: t("gallery"), icon: ImageIcon },
    { href: "/admin/blog", label: t("blog"), icon: FileText },
    { href: "/admin/camp-settings", label: t("settings"), icon: Settings }
  ];
  if (isSuper) {
    links.push({ href: "/admin/utenti", label: t("users"), icon: UserCog });
    links.push({ href: "/admin/audit", label: t("audit"), icon: History });
  }

  const isActive = (h: string) => (h === "/admin" ? pathname === "/admin" : pathname.startsWith(h));

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  const switchLang = async () => {
    const current = document.cookie.match(/admin-lang=(\w+)/)?.[1] ?? "it";
    const next = current === "it" ? "en" : "it";
    document.cookie = `admin-lang=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  };

  const sidebarContent = (
    <>
      <div className="p-5 border-b" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/wwf.png" alt="WWF" className="h-10 brightness-0 invert mb-2" />
        <p className="text-xs uppercase tracking-cta" style={{ color: "rgba(255,255,255,0.50)" }}>{t("adminTitle")}</p>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-5 py-3 text-sm font-bold uppercase tracking-cta transition-colors ${
              isActive(l.href) ? "bg-wwf-green text-white" : "hover:bg-white/10"
            }`}
            style={!isActive(l.href) ? { color: "rgba(255,255,255,0.75)" } : undefined}
          >
            <l.icon size={18} /> {l.label}
          </Link>
        ))}
      </nav>
      <div className="p-5 border-t" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
        <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.50)" }}>{session.email}</p>
        <p className="text-xs uppercase mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>{isSuper ? tRoles("superadmin") : tRoles("manager")}</p>
        <div className="flex items-center justify-between">
          <button onClick={logout} className="flex items-center gap-2 text-sm transition-colors hover:text-wwf-orange" style={{ color: "rgba(255,255,255,0.60)" }}>
            <LogOut size={16} /> {t("logout")}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={switchLang} className="text-xs font-bold uppercase tracking-cta px-2 py-1 rounded transition-colors hover:bg-white/10" style={{ color: "rgba(255,255,255,0.60)" }}>
              IT | EN
            </button>
            <AdminThemeToggle />
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded bg-ink text-white"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label={mobileOpen ? tNav("closeMenu") : tNav("openMenu")}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col sticky top-0 h-screen" style={{ background: "#0f1a0c", color: "#e8e6e3" }}>
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "#0f1a0c", color: "#e8e6e3" }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
