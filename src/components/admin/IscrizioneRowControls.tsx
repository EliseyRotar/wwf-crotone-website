"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function IscrizioneRowControls({
  id,
  status,
  feePaid,
  balancePaid,
  notes
}: {
  id: string;
  status: string;
  feePaid: boolean;
  balancePaid: boolean;
  notes: string | null;
}) {
  const [st, setSt] = useState(status);
  const [fee, setFee] = useState(feePaid);
  const [bal, setBal] = useState(balancePaid);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const t = useTranslations("Admin.iscrizioni");

  const update = async (patch: Record<string, unknown>) => {
    setSaving(true);
    await fetch("/api/admin/iscrizioni", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch })
    });
    setSaving(false);
    router.refresh();
  };

  const onStatus = (v: string) => {
    setSt(v);
    update({ status: v, notes });
  };

  const onFee = () => {
    const v = !fee;
    setFee(v);
    update({ status: st, notes, feePaid: v });
  };

  const onBal = () => {
    const v = !bal;
    setBal(v);
    update({ status: st, notes, balancePaid: v });
  };

  const statusColors: Record<string, string> = {
    pending: "tag-grey",
    confirmed: "tag-blue",
    paid: "tag-green",
    cancelled: "tag-red",
    waitlist: "tag-orange"
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        value={st}
        onChange={(e) => onStatus(e.target.value)}
        disabled={saving}
        className={`tag ${statusColors[st] ?? "tag-grey"} border-0 cursor-pointer`}
      >
        <option value="pending">{t("pending")}</option>
        <option value="confirmed">{t("confirmed")}</option>
        <option value="paid">{t("paid")}</option>
        <option value="waitlist">{t("waitlist")}</option>
        <option value="cancelled">{t("cancelled")}</option>
      </select>
      <button
        type="button"
        onClick={onFee}
        disabled={saving}
        title={t("fee100")}
        className={`tag ${fee ? "tag-green" : "tag-grey"} cursor-pointer border-0`}
      >
        {fee ? "✓" : "○"} 100€
      </button>
      <button
        type="button"
        onClick={onBal}
        disabled={saving}
        title={t("balance")}
        className={`tag ${bal ? "tag-green" : "tag-grey"} cursor-pointer border-0`}
      >
        {bal ? "✓" : "○"} {t("balance")}
      </button>
      {saving && <span className="text-xs text-ink-grey">…</span>}
    </div>
  );
}