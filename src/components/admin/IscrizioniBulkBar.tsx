"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckSquare, Square, Trash2, Mail } from "lucide-react";

/**
 * F31: Bulk row selection bar.
 * - Sits above the iscrizioni table
 * - "Select all on this page" + per-row checkbox (look for .row-check)
 * - Shows selected count, exposes bulk actions (CSV export, status update)
 */
export default function IscrizioniBulkBar({ ids }: { ids: string[] }) {
  const t = useTranslations("Admin.iscrizioni");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const checks = Array.from(document.querySelectorAll<HTMLInputElement>(".row-check"));
    const handler = () => {
      setSelected(checks.filter((c) => c.checked).map((c) => c.value));
    };
    checks.forEach((c) => c.addEventListener("change", handler));
    return () => checks.forEach((c) => c.removeEventListener("change", handler));
  }, [ids.length]);

  const allChecked = ids.length > 0 && selected.length === ids.length;
  const someChecked = selected.length > 0 && selected.length < ids.length;

  const toggleAll = () => {
    const checks = Array.from(document.querySelectorAll<HTMLInputElement>(".row-check"));
    const next = !allChecked;
    checks.forEach((c) => {
      c.checked = next;
    });
    setSelected(next ? ids : []);
  };

  const exportSelected = () => {
    if (selected.length === 0) return;
    const url = `/api/admin/iscrizioni/csv?ids=${selected.join(",")}`;
    window.location.href = url;
  };

  const bulkUpdate = async (status: string) => {
    if (selected.length === 0) return;
    if (!confirm(t("bulkConfirm", { count: selected.length, status }))) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/iscrizioni/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected, status })
      });
      const json = await res.json();
      if (json.ok) {
        window.location.reload();
      } else {
        alert(t("error") + ": " + (json.error || ""));
      }
    } catch {
      alert(t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 mb-3 p-3 bg-sand rounded-lg flex-wrap">
      <button
        type="button"
        onClick={toggleAll}
        className="flex items-center gap-2 text-sm"
        aria-label={allChecked ? t("deselectAll") : t("selectAll")}
      >
        {allChecked || someChecked ? <CheckSquare size={18} className="text-wwf-green" /> : <Square size={18} />}
        <span className="text-sm">
          {t("select")} ({selected.length}/{ids.length})
        </span>
      </button>
      {selected.length > 0 && (
        <>
          <button
            type="button"
            onClick={exportSelected}
            disabled={busy}
            className="text-sm underline text-ink-grey hover:text-ink flex items-center gap-1"
          >
            <Mail size={14} /> CSV ({selected.length})
          </button>
          <span className="text-ink-grey-light">|</span>
          <button
            type="button"
            onClick={() => bulkUpdate("confirmed")}
            disabled={busy}
            className="text-xs tag tag-green"
          >
            → {t("confirmed")}
          </button>
          <button
            type="button"
            onClick={() => bulkUpdate("paid")}
            disabled={busy}
            className="text-xs tag tag-green"
          >
            → {t("paid")}
          </button>
          <button
            type="button"
            onClick={() => bulkUpdate("cancelled")}
            disabled={busy}
            className="text-xs tag tag-red"
          >
            <Trash2 size={12} /> → {t("cancelled")}
          </button>
        </>
      )}
    </div>
  );
}
