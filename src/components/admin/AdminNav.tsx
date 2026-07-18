"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, CalendarDays, Image as ImageIcon, LogOut, UserCog } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";

export default function AdminNav({ session }: { session: SessionUser }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();

  const isSuper = session.role === "superadmin";

  const links = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/iscrizioni", label: "Iscrizioni", icon: Users },
    { href: "/admin/operatori", label: "Operatori", icon: Users },
    { href: "/admin/roster", label: "Roster", icon: CalendarDays },
    { href: "/admin/turni", label: "Turni", icon: CalendarDays },
    { href: "/admin/gallery", label: "Galleria", icon: ImageIcon },
    { href: "/admin/blog", label: "Blog", icon: ImageIcon },
    { href: "/admin/camp-settings", label: "Impostazioni", icon: UserCog }
  ];
  if (isSuper) links.push({ href: "/admin/utenti", label: "Utenti", icon: UserCog });

  const isActive = (h: string) => (h === "/admin" ? pathname === "/admin" : pathname.startsWith(h));

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <aside className="w-60 shrink-0 flex flex-col sticky top-0 h-screen" style={{ background: "#0f1a0c", color: "#e8e6e3" }}>
      <div className="p-5 border-b" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/wwf.png" alt="WWF" className="h-10 brightness-0 invert mb-2" />
        <p className="text-xs uppercase tracking-cta" style={{ color: "rgba(255,255,255,0.50)" }}>Admin WWF Crotone</p>
      </div>
      <nav className="flex-1 py-4">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
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
        <p className="text-xs uppercase mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>{isSuper ? "Superadmin" : "Manager"}</p>
        <div className="flex items-center justify-between">
          <button onClick={logout} className="flex items-center gap-2 text-sm transition-colors hover:text-wwf-orange" style={{ color: "rgba(255,255,255,0.60)" }}>
            <LogOut size={16} /> Esci
          </button>
          <AdminThemeToggle />
        </div>
      </div>
    </aside>
  );
}