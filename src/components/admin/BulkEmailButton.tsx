"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Mail, X, Calendar } from "lucide-react";

export default function BulkEmailButton({ turnoId }: { turnoId?: string }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [schedule, setSchedule] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const t = useTranslations("Admin.bulkEmail");
  const tIsc = useTranslations("Admin.iscrizioni");
  const tC = useTranslations("Admin.common");

  const send = async () => {
    if (!subject || !body) return;
    if (schedule && !scheduleAt) {
      setMsg(t("error") + ": " + t("missingSchedule"));
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const payload: Record<string, unknown> = { subject, body, turnoId, locale: "it" };
      if (schedule) payload.scheduleAt = new Date(scheduleAt).toISOString();
      const res = await fetch("/api/admin/bulk-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.ok) {
        if (json.scheduled) {
          setMsg(t("scheduled", { when: new Date(json.scheduleAt).toLocaleString("it-IT") }));
        } else {
          setMsg(t("sent", { count: json.sent }));
        }
        setSubject(""); setBody(""); setScheduleAt(""); setSchedule(false);
        setTimeout(() => { setOpen(false); setMsg(null); }, 2500);
      } else {
        setMsg(t("error") + ": " + (json.error || t("unknown")));
      }
    } catch {
      setMsg(t("error"));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-outline">
        <Mail size={18} /> {tIsc("emailTurn")}
      </button>
    );
  }

  return (
    <div className="card max-w-xl">
      <div className="card-body">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg">{t("title")}</h3>
          <button onClick={() => setOpen(false)} className="text-[var(--ad-text-muted)] hover:text-[var(--ad-text)]"><X size={20} /></button>
        </div>
        <div className="field">
          <label>{t("subject")}</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("subjectPlaceholder")} />
        </div>
        <div className="field">
          <label>{t("body")}</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder={t("bodyPlaceholder")} />
        </div>
        <label className="flex items-center gap-2 text-sm mb-2">
          <input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} />
          <Calendar size={14} /> {t("scheduleLabel")}
        </label>
        {schedule && (
          <div className="field">
            <label>{t("scheduleAt")}</label>
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
            />
          </div>
        )}
        {msg && <p className="text-sm mt-2 text-[var(--ad-text)]">{msg}</p>}
        <div className="flex gap-2 mt-3">
          <button onClick={send} disabled={busy} className="btn btn-green">{busy ? tC("loading") : (schedule ? t("schedule") : t("send"))}</button>
          <button onClick={() => setOpen(false)} className="btn btn-outline">{t("cancel")}</button>
        </div>
      </div>
    </div>
  );
}
