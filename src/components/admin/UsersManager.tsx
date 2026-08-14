"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2, UserPlus } from "lucide-react";

export default function UsersManager({
  users,
  turni,
  currentId
}: {
  users: { id: string; email: string; name: string | null; role: string; assignedTurns: string | null; expiresAt: string | null; active: boolean }[];
  turni: { id: string; number: number; endDate: Date }[];
  currentId: string;
}) {
  const router = useRouter();
  const t = useTranslations("Admin.users");
  const tC = useTranslations("Admin.common");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("manager");
  const [assigned, setAssigned] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (id: string) =>
    setAssigned((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/utenti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          password,
          role,
          assignedTurns: role === "manager" ? assigned.join(",") : null
        })
      });
      const json = await res.json();
      if (json.ok) {
        setEmail(""); setName(""); setPassword(""); setAssigned([]);
        router.refresh();
      } else {
        setErr(json.error === "exists" ? t("emailExists") : tC("error"));
      }
    } finally {
      setBusy(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm(t("delete"))) return;
    await fetch("/api/admin/utenti", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    router.refresh();
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div className="card">
        <div className="card-body">
          <h2 className="font-head text-xl text-[var(--ad-text)] mb-4">{t("newUser")}</h2>
          <form onSubmit={create} className="space-y-3">
            <div className="field">
              <label>{t("email")}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>{t("name")}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label>{t("password")}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="field">
              <label>{t("role")}</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="manager">{t("manager")}</option>
                <option value="superadmin">{t("superadmin")}</option>
              </select>
            </div>
            {role === "manager" && (
              <div className="field">
                <label>{t("assignedTurns")}</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {turni.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggle(t.id)}
                      className={`tag ${assigned.includes(t.id) ? "tag-green" : "tag-grey"}`}
                    >
                      {t.number}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {err && <p className="field-error">{err}</p>}
            <button type="submit" disabled={busy} className="btn btn-green">
              <UserPlus size={18} /> {busy ? tC("loading") : t("create")}
            </button>
          </form>
        </div>
      </div>

      <div>
        <h2 className="font-head text-xl text-[var(--ad-text)] mb-4">{t("existingUsers")} ({users.length})</h2>
        <div className="space-y-2">
          {users.map((u) => {
            const expired = u.expiresAt && new Date(u.expiresAt).getTime() < Date.now();
            return (
            <div key={u.id} className="flex items-center justify-between p-3 bg-surface border border-[var(--ad-border)]">
              <div>
                <p className="font-bold">{u.email} {u.id === currentId && <span className="text-xs text-[var(--ad-accent)]">{t("you")}</span>}</p>
                <p className="text-xs text-[var(--ad-text-muted)]">
                  {u.role === "superadmin" ? t("superadmin") : t("manager")} — {u.name ?? "—"}
                  {!u.active && <span className="text-[var(--ad-danger)] ml-2">{t("disabled")}</span>}
                  {expired && <span className="text-[var(--ad-danger)] ml-2">{t("expired")}</span>}
                  {u.expiresAt && !expired && <span className="ml-2">{t("expires")} {new Date(u.expiresAt).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>}
                </p>
              </div>
              {u.id !== currentId && (
                <button onClick={() => del(u.id)} className="text-[var(--ad-danger)] hover:bg-[var(--ad-danger-soft)] p-2" aria-label={tC("delete")}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}