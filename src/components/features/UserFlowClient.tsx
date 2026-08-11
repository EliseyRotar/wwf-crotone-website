"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Loader2, CheckCircle2, AlertTriangle, Upload, Lock, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * Single client component that handles the post-submit user flow.
 *
 * Steps driven by the Iscrizione.status returned from the server:
 *   - "pending"            → "verify your email" (CTA: re-send or check spam)
 *   - "email_verified"     → upload a receipt (file picker + submit)
 *   - "receipt_uploaded"   → "wait for admin approval" notice
 *   - "confirmed"          → "you're in" + optional set-password card
 *   - "cancelled"          → notice
 *
 * The page that renders this is expected to pass the latest
 * Iscrizione snapshot as a prop. The component never re-fetches the
 * Iscrizione — it triggers `router.refresh()` after each mutation so
 * the server-rendered shell can re-query and pass a fresh snapshot.
 *
 * Endpoints (all under /api/iscrizione/[id]):
 *   - POST verify-email
 *   - POST upload-receipt
 *   - POST set-password
 *
 * Auth model: the page must verify the volunteer owns this
 * Iscrizione before mounting. We don't re-check ownership here — the
 * server routes do.
 */

type Status =
  | "pending"
  | "email_verified"
  | "receipt_uploaded"
  | "confirmed"
  | "cancelled"
  | "waitlist"
  | string;

export type UserFlowProps = {
  iscrizioneId: string;
  status: Status;
  hasPassword: boolean;
  emailVerifiedAt: string | null;
  receiptUploadedAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  editsLockedAt: string | null;
  /** When the verify flow has just been completed in this session, the
   * page can pass the just-returned status through and we render the
   * "email verified" success card. */
  justVerified?: boolean;
};

type Phase = "verify" | "upload" | "awaiting" | "confirmed" | "cancelled" | "waitlist";

function phaseFromStatus(status: Status, editsLockedAt: string | null, confirmedAt: string | null, cancelledAt: string | null): Phase {
  if (status === "cancelled" || cancelledAt) return "cancelled";
  if (status === "confirmed" || confirmedAt) return "confirmed";
  if (status === "receipt_uploaded") return "awaiting";
  if (status === "email_verified") return "upload";
  if (status === "waitlist") return "waitlist";
  if (editsLockedAt) return "cancelled";
  return "verify";
}

export default function UserFlowClient(props: UserFlowProps) {
  const t = useTranslations("Account");
  const tErr = useTranslations("Account.errors");
  const loc = useLocale();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [phase, setPhase] = useState<Phase>(() =>
    phaseFromStatus(props.status, props.editsLockedAt, props.confirmedAt, props.cancelledAt)
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(
    props.justVerified ? t("verifyEmail.success") : null
  );

  // ---------- verify-email submit (used when user pastes the token) ----------
  // The page also redirects on the same flow via the API, but a fallback
  // form is useful if the user copied the token manually.
  const [token, setToken] = useState("");
  async function onVerifySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/iscrizione/${props.iscrizioneId}/verify-email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token })
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; status?: string };
      if (res.ok && json.ok) {
        setInfo(t("verifyEmail.success"));
        setPhase("upload");
        startTransition(() => router.refresh());
      } else {
        setErr(json.error ?? "server");
      }
    } catch {
      setErr("network");
    } finally {
      setBusy(false);
    }
  }

  // ---------- upload-receipt ----------
  const [file, setFile] = useState<File | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  async function onUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || busy) return;
    if (file.size > 10 * 1024 * 1024) {
      setFileErr(t("uploadReceipt.errorTooLarge"));
      return;
    }
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      setFileErr(t("uploadReceipt.errorWrongType"));
      return;
    }
    setBusy(true);
    setErr(null);
    setFileErr(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("type", "deposit");
      const res = await fetch(`/api/iscrizione/${props.iscrizioneId}/upload-receipt`, {
        method: "POST",
        credentials: "include",
        body: form
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && json.ok) {
        setInfo(t("uploadReceipt.success"));
        setPhase("awaiting");
        startTransition(() => router.refresh());
      } else {
        setErr(json.error ?? "server");
      }
    } catch {
      setErr("network");
    } finally {
      setBusy(false);
    }
  }

  // ---------- set-password (only shown on confirmed) ----------
  const [password, setPassword] = useState("");
  const [pwInfo, setPwInfo] = useState<string | null>(null);
  async function onSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/iscrizione/${props.iscrizioneId}/set-password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password })
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && json.ok) {
        setPwInfo(t("setPassword.success"));
        setPassword("");
        startTransition(() => router.refresh());
      } else {
        setErr(json.error ?? "server");
      }
    } catch {
      setErr("network");
    } finally {
      setBusy(false);
    }
  }

  // ---------- render ----------
  return (
    <div className="space-y-6" data-testid="user-flow" data-phase={phase} data-locale={loc}>
      {info && (
        <div className="rounded-md border border-wwf-green/40 bg-wwf-green/10 px-4 py-3 text-sm flex items-start gap-2">
          <CheckCircle2 size={16} className="text-wwf-green mt-0.5" />
          <span>{info}</span>
        </div>
      )}
      {err && (
        <div className="rounded-md border border-tag-red/40 bg-tag-red/10 px-4 py-3 text-sm flex items-start gap-2">
          <AlertTriangle size={16} className="text-tag-red mt-0.5" />
          <span>{errMsg(tErr, err)}</span>
        </div>
      )}

      {phase === "verify" && (
        <div className="card">
          <div className="card-body space-y-3">
            <h2 className="text-xl font-semibold">{t("verifyEmail.title")}</h2>
            <p className="text-sm text-ink-2">
              {loc === "it"
                ? "Controlla la tua email: ti abbiamo inviato un link per confermare l'iscrizione (valido 24 ore)."
                : "Check your email: we sent you a link to confirm your registration (valid for 24 hours)."}
            </p>
            <details className="text-sm">
              <summary className="cursor-pointer text-ink-2 underline">
                {loc === "it" ? "Incolla qui il token se non riesci a cliccare il link" : "Paste the token here if you can't click the link"}
              </summary>
              <form onSubmit={onVerifySubmit} className="mt-3 space-y-2">
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="input w-full"
                  placeholder="token"
                  aria-label="verify token"
                />
                <button
                  type="submit"
                  className="btn btn-primary text-sm flex items-center gap-2"
                  disabled={!token || busy}
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                  {loc === "it" ? "Verifica" : "Verify"}
                </button>
              </form>
            </details>
          </div>
        </div>
      )}

      {phase === "upload" && (
        <div className="card">
          <div className="card-body space-y-3">
            <h2 className="text-xl font-semibold">{t("uploadReceipt.title")}</h2>
            <p className="text-sm text-ink-2">
              {loc === "it"
                ? "Carica la ricevuta del bonifico di € 100 (PDF, JPG o PNG, max 10 MB). L'amministratore la verificherà a breve."
                : "Upload your €100 bank transfer receipt (PDF, JPG or PNG, max 10 MB). An admin will review it shortly."}
            </p>
            <form onSubmit={onUploadSubmit} className="space-y-3">
              <label className="block text-sm">
                <span className="text-ink-2">{t("uploadReceipt.chooseFile")}</span>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setFileErr(null);
                  }}
                  disabled={busy}
                  className="mt-1 block text-sm"
                  aria-label="receipt file"
                />
              </label>
              {fileErr && <p className="text-xs text-tag-red">{fileErr}</p>}
              <button
                type="submit"
                className="btn btn-primary text-sm flex items-center gap-2"
                disabled={!file || busy}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {loc === "it" ? "Carica ricevuta" : "Upload receipt"}
              </button>
            </form>
          </div>
        </div>
      )}

      {phase === "awaiting" && (
        <div className="card">
          <div className="card-body space-y-2 text-sm">
            <h2 className="text-lg font-semibold">
              {loc === "it" ? "Ricevuta ricevuta" : "Receipt received"}
            </h2>
            <p className="text-ink-2">
              {loc === "it"
                ? "La tua ricevuta è stata inoltrata all'amministratore per la verifica. Riceverai una email quando l'iscrizione sarà confermata."
                : "Your receipt has been forwarded to the admin for review. You'll get an email once the registration is confirmed."}
            </p>
          </div>
        </div>
      )}

      {phase === "confirmed" && (
        <div className="card">
          <div className="card-body space-y-3">
            <h2 className="text-xl font-semibold text-wwf-green">
              {loc === "it" ? "Iscrizione confermata" : "Registration confirmed"}
            </h2>
            <p className="text-sm text-ink-2">
              {loc === "it"
                ? "Tutto pronto. Se vuoi puoi impostare una password per accedere anche senza magic link."
                : "You're all set. Optionally set a password to sign in without a magic link."}
            </p>
            {!props.hasPassword ? (
              <form onSubmit={onSetPassword} className="space-y-2">
                <label className="block text-sm">
                  <span className="text-ink-2">{t("setPassword.title")}</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    className="input w-full mt-1"
                    aria-label="new password"
                  />
                </label>
                <button
                  type="submit"
                  className="btn btn-primary text-sm flex items-center gap-2"
                  disabled={password.length < 8 || busy}
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                  {loc === "it" ? "Imposta password" : "Set password"}
                </button>
                {pwInfo && <p className="text-xs text-ink-2">{pwInfo}</p>}
              </form>
            ) : (
              <p className="text-xs text-ink-grey">
                {loc === "it" ? "Password già impostata." : "Password already set."}
              </p>
            )}
          </div>
        </div>
      )}

      {phase === "cancelled" && (
        <div className="card">
          <div className="card-body space-y-2 text-sm">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Lock size={16} />
              {t("panel.locked")}
            </h2>
            <p className="text-ink-2">
              {loc === "it"
                ? "Questa iscrizione non è modificabile. Contattaci per maggiori informazioni."
                : "This registration can't be edited. Contact us for more info."}
            </p>
          </div>
        </div>
      )}

      {phase === "waitlist" && (
        <div className="card">
          <div className="card-body space-y-2 text-sm">
            <h2 className="text-lg font-semibold">
              {loc === "it" ? "Sei in lista d'attesa" : "You're on the waitlist"}
            </h2>
            <p className="text-ink-2">
              {loc === "it"
                ? "Il turno scelto è al completo. Ti contatteremo non appena si libera un posto."
                : "The chosen turn is full. We'll contact you as soon as a spot opens up."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function errMsg(tErr: (k: string) => string, code: string): string {
  // Map known server error codes to a localised message; fall back to
  // the raw code so the user (and devs) can still see it.
  const key = code as keyof IntlMessages["Account"]["errors"] extends string
    ? string
    : string;
  try {
    return tErr(key) !== key ? tErr(key) : code;
  } catch {
    return code;
  }
}

// Local IntlMessages shim — we don't import the full next-intl types
// to keep this client file free of server-only deps.
type IntlMessages = { Account: { errors: Record<string, string> } };
