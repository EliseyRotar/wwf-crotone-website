"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Save } from "lucide-react";

type Settings = {
  year: number;
  startDate: string;
  endDate: string;
  numCampi: number;
  campDurationDays: number;
  costNonMember: number;
  costMember: number;
  minorInsurance: number;
  registrationFee: number;
  iban: string;
  isActive: boolean;
};

export default function CampSettingsEditor({ settings }: { settings: Settings | null }) {
  const router = useRouter();
  const t = useTranslations("Admin.campSettings");
  const tC = useTranslations("Admin.common");
  const [data, setData] = useState<Settings>(settings ?? {
    year: 2026, startDate: "2026-06-21", endDate: "2026-09-13", numCampi: 12,
    campDurationDays: 7, costNonMember: 430, costMember: 400, minorInsurance: 20,
    registrationFee: 100, iban: "IT30V0306909606100000107334", isActive: true
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const set = (k: keyof Settings, v: string | number | boolean) =>
    setData((d) => ({ ...d, [k]: v }));

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/camp-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.ok) {
        setMsg(t("saved"));
        router.refresh();
      } else {
        setMsg(tC("error") + ": " + (json.error || tC("unknown")));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="font-head text-3xl text-[var(--ad-text)] tracking-tight mb-1">{t("title")}</h1>
      <p className="text-[var(--ad-text-muted)] text-sm mb-8">{t("subtitle")}</p>

      <div className="card max-w-2xl">
        <div className="card-body">
          <div className="grid sm:grid-cols-2 gap-x-4">
            <div className="field">
              <label>{t("year")}</label>
              <input type="number" value={data.year} onChange={(e) => set("year", Number(e.target.value))} />
            </div>
            <div className="field">
              <label>{t("numCampi")}</label>
              <input type="number" value={data.numCampi} onChange={(e) => set("numCampi", Number(e.target.value))} />
            </div>
            <div className="field">
              <label>{t("startDate")}</label>
              <input type="date" value={data.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </div>
            <div className="field">
              <label>{t("endDate")}</label>
              <input type="date" value={data.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </div>
            <div className="field">
              <label>{t("campoDuration")}</label>
              <input type="number" value={data.campDurationDays} onChange={(e) => set("campDurationDays", Number(e.target.value))} />
            </div>
            <div className="field">
              <label>{t("costNonMember")}</label>
              <input type="number" value={data.costNonMember} onChange={(e) => set("costNonMember", Number(e.target.value))} />
            </div>
            <div className="field">
              <label>{t("costMember")}</label>
              <input type="number" value={data.costMember} onChange={(e) => set("costMember", Number(e.target.value))} />
            </div>
            <div className="field">
              <label>{t("minorInsurance")}</label>
              <input type="number" value={data.minorInsurance} onChange={(e) => set("minorInsurance", Number(e.target.value))} />
            </div>
            <div className="field">
              <label>{t("registrationFee")}</label>
              <input type="number" value={data.registrationFee} onChange={(e) => set("registrationFee", Number(e.target.value))} />
            </div>
            <div className="field sm:col-span-2">
              <label>{t("iban")}</label>
              <input value={data.iban} onChange={(e) => set("iban", e.target.value)} className="font-mono" />
            </div>
            <div className="field sm:col-span-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={data.isActive} onChange={(e) => set("isActive", e.target.checked)} />
                {t("active")}
              </label>
            </div>
          </div>
          {msg && <p className="text-sm mt-3 text-[var(--ad-text)]">{msg}</p>}
          <button onClick={save} disabled={busy} className="btn btn-green mt-4">
            <Save size={18} /> {busy ? tC("loading") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}