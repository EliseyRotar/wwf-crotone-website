"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Image as ImageIcon,
  LogOut,
  UserCog,
  ClipboardList,
  Menu,
  X,
  FileText,
  Settings,
  History,
  Activity
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";

type Link = { href: string; label: string; icon: typeof Users };

export default function AdminShell({
  session,
  children
}: {
  session: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const t = useTranslations("Admin.nav");
  const tRoles = useTranslations("Admin.roles");
  const tNav = useTranslations("Nav");
  const [mobileOpen, setMobileOpen] = useState(false);

  const isSuper = session.role === "superadmin";

  const links: Link[] = [
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
    links.push({ href: "/admin/status", label: t("status"), icon: Activity });
    links.push({ href: "/admin/utenti", label: t("users"), icon: UserCog });
    links.push({ href: "/admin/audit", label: t("audit"), icon: History });
  }

  const isActive = (h: string) =>
    h === "/admin" ? pathname === "/admin" : pathname.startsWith(h);

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  const switchLang = async () => {
    const current = document.cookie.match(/admin-lang=(\w+)/)?.[1] ?? "it";
    const next = current === "it" ? "en" : "it";
    document.cookie = `admin-lang=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax; Secure`;
    router.refresh();
  };

  const NavLink = ({ l }: { l: Link }) => {
    const active = isActive(l.href);
    return (
      <Link
        href={l.href}
        onClick={() => setMobileOpen(false)}
        className={`group flex items-center gap-3 px-3 py-2 text-sm rounded-[var(--radius-sm)] transition-colors duration-150 ${
          active
            ? "bg-wwf-green text-white font-semibold"
            : "text-[var(--ad-text)] hover:bg-wwf-green-pale/40 hover:text-wwf-green-dark"
        }`}
      >
        <l.icon
          size={16}
          strokeWidth={active ? 2.25 : 1.75}
          className="shrink-0"
        />
        <span className="truncate">{l.label}</span>
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-[var(--ad-border)]">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/wwf.png"
            alt="WWF"
            className="h-9 w-9"
          />
          <div className="leading-tight">
            <p className="font-head text-base uppercase tracking-wider text-[var(--ad-text)]">WWF Crotone</p>
            <p className="text-[11px] uppercase tracking-wider text-[var(--ad-text-subtle)]">
              {t("adminTitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Links */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto" aria-label={t("adminTitle")}>
        <ul className="space-y-0.5">
          {links.map((l) => (
            <li key={l.href}>
              <NavLink l={l} />
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[var(--ad-border)]">
        <p className="text-xs text-[var(--ad-text)] truncate" title={session.email}>
          {session.email}
        </p>
        <p className="text-[11px] uppercase tracking-wider text-[var(--ad-text-subtle)] mt-0.5">
          {isSuper ? tRoles("superadmin") : tRoles("manager")}
        </p>
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--ad-text-muted)] hover:text-[var(--ad-danger)] transition-colors"
          >
            <LogOut size={14} /> {t("logout")}
          </button>
          <button
            onClick={switchLang}
            className="text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-[var(--radius-sm)] text-[var(--ad-text-muted)] hover:bg-[var(--ad-bg-sunken)] transition-colors"
          >
            IT | EN
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[var(--ad-bg)]">
      {/* Desktop sidebar — directive §3 layout variety: persistent left nav (sticky, full height) */}
      <aside className="hidden lg:flex w-60 shrink-0 sticky top-0 h-screen border-r border-[var(--ad-border)] bg-sand">
        {sidebarContent}
      </aside>

      {/* Mobile: top bar + slide-in drawer */}
      <header className="lg:hidden fixed inset-x-0 top-0 z-40 h-14 flex items-center gap-3 px-4 border-b border-[var(--ad-border)] bg-sand">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? tNav("closeMenu") : tNav("openMenu")}
          className="p-2 -ml-2 text-[var(--ad-text)]"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/wwf.png" alt="WWF" className="h-6 w-6" />
          <span className="font-head text-sm uppercase tracking-wider">WWF Crotone · Admin</span>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 border-r border-[var(--ad-border)] bg-sand transform transition-transform duration-200 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Main */}
      <main
        id="main"
        className="flex-1 min-w-0 pt-14 lg:pt-0 px-4 sm:px-6 lg:px-10 py-6 lg:py-10"
      >
        {children}
      </main>
    </div>
  );
}