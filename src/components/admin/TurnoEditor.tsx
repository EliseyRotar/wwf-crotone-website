"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function TurnoEditor({
  id,
  capacity,
  isActive
}: {
  id: string;
  capacity: number;
  isActive: boolean;
}) {
  const t = useTranslations("Admin.turni");
  const tC = useTranslations("Admin.common");
  const [cap, setCap] = useState(capacity);
  const [active, setActive] = useState(isActive);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const save = async () => {
    setSaving(true);
    await fetch("/api/admin/turni", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, capacity: Number(cap), isActive: active })
    });
    setSaving(false);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        value={cap}
        onChange={(e) => setCap(Number(e.target.value))}
        className="w-20 px-2 py-1 border-2 border-[var(--ad-border)] focus:border-[var(--ad-accent)]"
      />
      <label className="flex items-center gap-1 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        {t("active")}
      </label>
      <button onClick={save} disabled={saving} className="btn btn-green text-xs px-3 py-1">
        {saving ? tC("loading") : t("save")}
      </button>
    </div>
  );
}