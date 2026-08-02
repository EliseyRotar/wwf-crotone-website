"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";

/**
 * Receipt upload form for the personal area. The API lives at
 * POST /api/account/booking/[id]/receipt and accepts a multipart
 * form-data with `file` and `type` ("deposit" | "balance").
 *
 * On success we call `onUploaded()` and also `router.refresh()` so
 * any server-rendered parent re-renders with the new
 * "pending approval" state. We deliberately do NOT auto-approve —
 * the admin still has to verify the receipt from /admin/iscrizioni.
 */
export default function ReceiptUploader({
  iscrizioneId,
  type,
  onUploaded
}: {
  iscrizioneId: string;
  type: "deposit" | "balance";
  onUploaded: () => void;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function onPick(f: File | null) {
    setFile(f);
    setErr(null);
    setOk(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setErr("required");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("too-big");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("type", type);
      const res = await fetch(`/api/account/booking/${iscrizioneId}/receipt`, {
        method: "POST",
        credentials: "include",
        body: form
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setErr(json.error ?? "server");
        return;
      }
      setOk(true);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      router.refresh();
      onUploaded();
    } catch {
      setErr("network");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2" data-testid={`receipt-uploader-${type}`}>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        disabled={busy}
        className="block text-sm"
        aria-label="receipt file"
      />
      <button
        type="submit"
        className="btn btn-primary flex items-center gap-2 text-sm"
        disabled={!file || busy}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {busy ? "…" : <>{type === "deposit" ? "Upload deposit" : "Upload balance"}</>}
      </button>
      {err && (
        <p className="text-xs text-tag-red" role="alert">
          {err}
        </p>
      )}
      {ok && <p className="text-xs text-ink-2">✓ pending approval</p>}
    </form>
  );
}
