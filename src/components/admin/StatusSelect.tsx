"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StatusSelect({
  id,
  value,
  notes
}: {
  id: string;
  value: string;
  notes: string | null;
}) {
  const [status, setStatus] = useState(value);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const onChange = async (v: string) => {
    setStatus(v);
    setSaving(true);
    await fetch("/api/admin/iscrizioni", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: v, notes })
    });
    setSaving(false);
    router.refresh();
  };

  const colors: Record<string, string> = {
    pending: "tag-grey",
    confirmed: "tag-blue",
    paid: "tag-green",
    cancelled: "tag-red",
    waitlist: "tag-orange"
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={(e) => onChange(e.target.value)}
        disabled={saving}
        className={`tag ${colors[status] ?? "tag-grey"} border-0 cursor-pointer`}
      >
        <option value="pending">In attesa</option>
        <option value="confirmed">Confermato</option>
        <option value="paid">Pagato</option>
        <option value="waitlist">Lista d&apos;attesa</option>
        <option value="cancelled">Annullato</option>
      </select>
      {saving && <span className="text-xs text-ink-grey">…</span>}
    </div>
  );
}