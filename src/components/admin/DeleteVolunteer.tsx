"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";

export default function DeleteVolunteer({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const t = useTranslations("Admin.iscrizioni");

  const del = async () => {
    if (!confirm(t("deleteConfirm", { name }))) return;
    try {
      const res = await fetch("/api/admin/iscrizioni", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const json = await res.json();
      if (json.ok) {
        router.refresh();
      } else {
        alert(t("deleteError") + ": " + (json.error || "unknown"));
      }
    } catch {
      alert(t("networkError"));
    }
  };

  return (
    <button
      onClick={del}
      className="text-wwf-red hover:bg-wwf-red/10 p-1"
      aria-label={t("delete")}
      title={t("delete")}
    >
      <Trash2 size={15} />
    </button>
  );
}
