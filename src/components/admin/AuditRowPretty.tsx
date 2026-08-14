"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  UserCheck,
  FileText,
  Upload,
  CheckCircle2,
  XCircle,
  Edit3,
  Trash2,
  LogIn,
  Mail,
  Eye,
  EyeOff,
  Receipt
} from "lucide-react";

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  userId: string;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

const ACTION_ICON: Record<string, typeof Edit3> = {
  iscrizione_edit: Edit3,
  status_change: Edit3,
  receipt_upload: Upload,
  receipt_approve: CheckCircle2,
  receipt_reject: XCircle,
  delete: Trash2,
  login: LogIn,
  create: UserCheck,
  update: Edit3,
  settings_change: FileText
};

const ACTION_TONE: Record<string, "neutral" | "success" | "danger" | "info"> = {
  iscrizione_edit: "neutral",
  status_change: "neutral",
  receipt_upload: "info",
  receipt_approve: "success",
  receipt_reject: "danger",
  delete: "danger",
  login: "neutral",
  create: "success",
  update: "neutral"
};

const TONE_BG: Record<string, string> = {
  neutral: "var(--ad-bg-sunken)",
  success: "var(--ad-success-soft, #d1fae5)",
  danger: "var(--ad-danger-soft, #fee2e2)",
  info: "var(--ad-info-soft, #dbeafe)"
};
const TONE_FG: Record<string, string> = {
  neutral: "var(--ad-text-muted)",
  success: "var(--ad-success, #065f46)",
  danger: "var(--ad-danger, #991b1b)",
  info: "var(--ad-info, #1e40af)"
};

function safeJson(s: string | null): Record<string, unknown> | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Translate a key through next-intl. If the key is missing, returns
 * the fallback string. We use this a lot because the audit log is
 * open-ended — there are dozens of action and entity types and we
 * only have hand-written translations for the common ones.
 */
function tryT(
  t: (key: string, values?: Record<string, string | number>) => string,
  key: string,
  fallback: string,
  values?: Record<string, string | number>
): string {
  try {
    const out = t(key, values);
    // next-intl returns the key itself when missing; detect that.
    if (typeof out === "string" && out === key) return fallback;
    return out;
  } catch {
    return fallback;
  }
}

/**
 * Render a friendly human-readable summary of the audit row.
 *
 * Format examples:
 *   - "Mario Rossi (admin@wwf…) ha caricato una ricevuta"
 *   - "Mario Rossi ha cambiato lo stato dell'iscrizione di Carla Esposito:
 *      da «Email verificata» a «Ricevuta in revisione»"
 *   - "Mario Rossi ha modificato l'iscrizione di Carla Esposito: 3 campi"
 */
function renderPretty(
  t: ReturnType<typeof useTranslations>,
  log: AuditLog,
  actor: string,
  subject: { firstName: string; lastName: string } | null
): { headline: string; sublines: string[] } {
  const details = safeJson(log.details);
  const action = log.action;
  const subj = subject ? `${subject.firstName} ${subject.lastName}` : null;
  const subjSuffix = subj ? ` di ${subj}` : "";

  const headline = tryT(
    t,
    `prettyActions.${action}`,
    tryT(t, "prettyActions.default", `${actor} ha eseguito ${action}`, { actor, action }),
    { actor }
  );

  const sublines: string[] = [];

  if (log.entity === "iscrizione" && subj) {
    sublines.push(`Iscritto: ${subj}`);
  }

  if (details) {
    // Status changes: from → to
    if (action === "status_change" && details.from && details.to) {
      const fromLabel = tryT(t, `statusLabels.${String(details.from)}`, String(details.from));
      const toLabel = tryT(t, `statusLabels.${String(details.to)}`, String(details.to));
      sublines.push(`Stato: da «${fromLabel}» → «${toLabel}»`);
    }

    // Receipt upload
    if (action === "receipt_upload" && details.type) {
      const typeLabel = tryT(t, `receiptTypes.${String(details.type)}`, String(details.type));
      sublines.push(`Tipo: ${typeLabel}`);
      if (typeof details.objectKey === "string") {
        // Show just the basename, not the full R2 path
        const file = String(details.objectKey).split("/").pop() ?? details.objectKey;
        sublines.push(`File: ${file}`);
      }
    }

    // Receipt approve/reject
    if ((action === "receipt_approve" || action === "receipt_reject") && details.type) {
      const typeLabel = tryT(t, `receiptTypes.${String(details.type)}`, String(details.type));
      sublines.push(`Tipo: ${typeLabel}`);
      if (details.reason && typeof details.reason === "string") {
        sublines.push(`Motivo: ${details.reason}`);
      }
    }

    // Login
    if (action === "login") {
      if (typeof details.method === "string") {
        const methodLabel = tryT(t, `methodLabels.${details.method}`, details.method);
        sublines.push(`Metodo: ${methodLabel}`);
      }
      if (typeof details.persistent === "boolean") {
        const persistentLabel = tryT(
          t,
          `persistentLabels.${details.persistent}`,
          details.persistent ? "sì" : "no"
        );
        sublines.push(`Dispositivo ricordato: ${persistentLabel}`);
      }
    }

    // iscrizione_edit
    if (action === "iscrizione_edit") {
      const fields = Array.isArray(details.fields) ? details.fields : [];
      if (fields.length > 0) {
        sublines.push(`Campi modificati (${fields.length}): ${fields.slice(0, 6).join(", ")}${fields.length > 6 ? "…" : ""}`);
      }
      const rejected = details.rejected;
      if (rejected && typeof rejected === "object" && Object.keys(rejected).length > 0) {
        sublines.push(`Valori scartati: ${Object.keys(rejected).join(", ")}`);
      }
    }

    // Payment changes (status_change with payment keys)
    if (action === "status_change" || action === "iscrizione_edit") {
      if (typeof details.feePaid === "boolean") {
        const feeLabel = tryT(t, `paymentLabels.feePaid`, "Quota 100€");
        const stateLabel = tryT(t, `paymentLabels.${String(details.feePaid)}`, String(details.feePaid));
        sublines.push(`${feeLabel}: ${stateLabel}`);
      }
      if (typeof details.balancePaid === "boolean") {
        const balLabel = tryT(t, `paymentLabels.balancePaid`, "Saldo");
        const stateLabel = tryT(t, `paymentLabels.${String(details.balancePaid)}`, String(details.balancePaid));
        sublines.push(`${balLabel}: ${stateLabel}`);
      }
    }
  }

  return { headline: headline + subjSuffix, sublines };
}

export function AuditRowPretty({
  log,
  actor,
  subject,
  locale,
  showRawDefault
}: {
  log: AuditLog;
  actor: string;
  subject: { firstName: string; lastName: string } | null;
  locale: string;
  showRawDefault: boolean;
}) {
  const t = useTranslations("Admin");
  const [showRaw, setShowRaw] = useState(showRawDefault);

  const Icon = ACTION_ICON[log.action] ?? FileText;
  const tone = ACTION_TONE[log.action] ?? "neutral";
  const { headline, sublines } = renderPretty(t, log, actor, subject);
  const dateLocale = locale === "it" ? "it-IT" : "en-GB";
  const dateStr = log.createdAt.toLocaleString(dateLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 w-8 h-8 rounded-full grid place-items-center mt-0.5"
          style={{ background: TONE_BG[tone], color: TONE_FG[tone] }}
          aria-hidden="true"
        >
          <Icon size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--ad-text)] font-medium leading-snug">
            {headline}
          </p>
          {sublines.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-xs text-[var(--ad-text-muted)]">
              {sublines.map((line, i) => (
                <li key={i} className="leading-relaxed">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--ad-border)] mr-2 align-middle" />
                  {line}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--ad-text-subtle)]">
            <span className="font-mono tabular-nums">{dateStr}</span>
            <span className="text-[var(--ad-border)]">·</span>
            <span
              className="px-1.5 py-0.5 rounded-[var(--radius-sm)] font-semibold"
              style={{ background: TONE_BG[tone], color: TONE_FG[tone] }}
            >
              {log.action}
            </span>
            <span className="text-[var(--ad-border)]">·</span>
            <span>{log.entity}</span>
            {log.ipAddress && (
              <>
                <span className="text-[var(--ad-border)]">·</span>
                <span className="font-mono">{log.ipAddress}</span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowRaw((s) => !s)}
          className="shrink-0 text-[10px] uppercase tracking-wider px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--ad-border)] bg-[var(--ad-bg)] text-[var(--ad-text-muted)] hover:border-[var(--ad-accent)] hover:text-[var(--ad-accent)] transition-colors inline-flex items-center gap-1"
          title={showRaw ? t("rawDataHide") : t("rawDataShow")}
        >
          {showRaw ? <EyeOff size={11} /> : <Eye size={11} />}
          {showRaw ? "JSON" : "JSON"}
        </button>
      </div>

      {showRaw && (
        <pre className="mt-3 ml-11 text-[11px] font-mono leading-relaxed text-[var(--ad-text-muted)] bg-[var(--ad-bg-sunken)] border border-[var(--ad-border)] rounded-[var(--radius-sm)] px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
          {log.details
            ? JSON.stringify(JSON.parse(log.details), null, 2)
            : "—"}
        </pre>
      )}
    </div>
  );
}
