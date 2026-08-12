"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { UserPlus, X } from "lucide-react";

type Turno = { id: string; number: number; start: Date; end: Date };

export default function ManualAddVolunteer({ turni }: { turni: Turno[] }) {
  const router = useRouter();
  const t = useTranslations("Admin.manualAdd");
  const tIsc = useTranslations("Admin.iscrizioni");
  const tC = useTranslations("Admin.common");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState({
    firstName: "",
    lastName: "",
    birthDate: "",
    email: "",
    phone: "",
    isMinor: false,
    turnoIds: [] as string[],
    dietaryNeeds: "none",
    tshirtSize: "",
    status: "pending",
    feePaid: false,
    balancePaid: false,
    notes: ""
  });

  const set = (k: keyof typeof data, v: string | boolean | string[]) =>
    setData((d) => ({ ...d, [k]: v }));

  const toggleTurno = (id: string) => {
    setData((d) => ({
      ...d,
      turnoIds: d.turnoIds.includes(id) ? d.turnoIds.filter((x) => x !== id) : [...d.turnoIds, id]
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.firstName || !data.lastName || !data.email || !data.phone || data.turnoIds.length === 0) {
      setErr(t("fillRequired"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/iscrizioni/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.ok) {
        setData({
          firstName: "", lastName: "", birthDate: "", email: "", phone: "",
          isMinor: false, turnoIds: [], dietaryNeeds: "none", tshirtSize: "",
          status: "pending", feePaid: false, balancePaid: false, notes: ""
        });
        setOpen(false);
        router.refresh();
      } else {
        setErr(tC("error") + ": " + (json.error || tC("unknown")));
      }
    } catch {
      setErr(tC("networkError"));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-green">
        <UserPlus size={18} /> {tIsc("addVolunteer")}
      </button>
    );
  }

  return (
    <div className="card mb-6">
      <div className="card-body">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl">{t("title")}</h2>
          <button onClick={() => setOpen(false)} className="text-[var(--ad-text-muted)] hover:text-ink">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit} className="grid sm:grid-cols-2 gap-x-4">
          <div className="field">
            <label>{t("name")}</label>
            <input value={data.firstName} onChange={(e) => set("firstName", e.target.value)} required />
          </div>
          <div className="field">
            <label>{t("lastName")}</label>
            <input value={data.lastName} onChange={(e) => set("lastName", e.target.value)} required />
          </div>
          <div className="field">
            <label>{t("birthDate")}</label>
            <input type="date" value={data.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
          </div>
          <div className="field">
            <label>{t("email")}</label>
            <input type="email" value={data.email} onChange={(e) => set("email", e.target.value)} required />
          </div>
          <div className="field">
            <label>{t("phone")}</label>
            <input type="tel" value={data.phone} onChange={(e) => set("phone", e.target.value)} required />
          </div>
          <div className="field">
            <label>{t("minor")}</label>
            <select value={data.isMinor ? "yes" : "no"} onChange={(e) => set("isMinor", e.target.value === "yes")}>
              <option value="no">{t("no")}</option>
              <option value="yes">{t("yes")}</option>
            </select>
          </div>
          <div className="field">
            <label>{t("diet")}</label>
            <select value={data.dietaryNeeds} onChange={(e) => set("dietaryNeeds", e.target.value)}>
              <option value="none">{tC("none")}</option>
              <option value="vegetarian">{(tIsc("statusPending") === "In attesa") ? "Vegetariano" : "Vegetarian"}</option>
              <option value="vegan">{(tIsc("statusPending") === "In attesa") ? "Vegano" : "Vegan"}</option>
              <option value="celiac">{(tIsc("statusPending") === "In attesa") ? "Celiaco" : "Celiac"}</option>
              <option value="other">{(tIsc("statusPending") === "In attesa") ? "Altra" : "Other"}</option>
            </select>
          </div>
          <div className="field">
            <label>{t("tshirt")}</label>
            <select value={data.tshirtSize} onChange={(e) => set("tshirtSize", e.target.value)}>
              <option value="">—</option>
              {["S", "M", "L", "XL", "XXL"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t("status")}</label>
            <select value={data.status} onChange={(e) => set("status", e.target.value)}>
              <option value="pending">{tIsc("statusPending")}</option>
              <option value="confirmed">{tIsc("statusConfirmed")}</option>
              <option value="paid">{tIsc("statusPaid")}</option>
              <option value="waitlist">{tIsc("statusWaitlist")}</option>
              <option value="cancelled">{tIsc("statusCancelled")}</option>
            </select>
          </div>
          <div className="field">
            <label>{t("notes")}</label>
            <input value={data.notes} onChange={(e) => set("notes", e.target.value)} placeholder={t("notesPlaceholder")} />
          </div>
          <div className="field sm:col-span-2">
            <label>{t("campi")}</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {turni.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTurno(t.id)}
                  className={`tag ${data.turnoIds.includes(t.id) ? "tag-green" : "tag-grey"}`}
                >
                  C{t.number}
                </button>
              ))}
            </div>
          </div>
          <div className="field sm:col-span-2 flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={data.feePaid} onChange={(e) => set("feePaid", e.target.checked)} />
              {t("fee100")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={data.balancePaid} onChange={(e) => set("balancePaid", e.target.checked)} />
              {t("balancePaid")}
            </label>
          </div>
          {err && <p className="field-error sm:col-span-2">{err}</p>}
          <div className="sm:col-span-2 flex gap-2 mt-2">
            <button type="submit" disabled={busy} className="btn btn-green">
              {busy ? tC("loading") : t("save")}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-outline">
              {tC("cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}