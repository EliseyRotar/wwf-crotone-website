"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Monitor, Smartphone, Tablet, Trash2, Loader2 } from "lucide-react";

type Session = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastSeenAt: string;
  expiresAt: string;
  isCurrent: boolean;
  lastSeenLabel: string;
  expiresOnLabel: string;
};

type Labels = {
  revoke: string;
  revokeOthers: string;
  currentLabel: string;
  browserFallback: string;
  backLink: string;
  empty: string;
  error: string;
};

const UA_PATTERNS: { match: RegExp; icon: typeof Monitor; label: string }[] = [
  { match: /iPhone|iPad|iPod/, icon: Smartphone, label: "iOS" },
  { match: /Android/, icon: Smartphone, label: "Android" },
  { match: /Macintosh|Mac OS/, icon: Monitor, label: "macOS" },
  { match: /Windows/, icon: Monitor, label: "Windows" },
  { match: /iPad/, icon: Tablet, label: "iPad" },
  { match: /Linux/, icon: Monitor, label: "Linux" }
];

const BROWSER_PATTERNS: { match: RegExp; label: string }[] = [
  { match: /Edg\//, label: "Edge" },
  { match: /Firefox\//, label: "Firefox" },
  { match: /Chrome\//, label: "Chrome" },
  { match: /Safari\//, label: "Safari" }
];

function describe(ua: string | null, fallback: string) {
  if (!ua) return { os: fallback, browser: "" };
  const osMatch = UA_PATTERNS.find((p) => p.match.test(ua));
  const browserMatch = BROWSER_PATTERNS.find((p) => p.match.test(ua));
  return {
    os: osMatch?.label ?? fallback,
    browser: browserMatch?.label ?? ""
  };
}

export default function AccountSessionsClient({
  initial,
  labels
}: {
  initial: Session[];
  labels: Labels;
}) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const otherCount = sessions.filter((s) => !s.isCurrent).length;

  async function revokeOne(id: string) {
    if (busyId || busyAll) return;
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch("/api/account/sessions", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId: id })
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErr(json.error ?? labels.error);
        return;
      }
      setSessions((cur) => cur.filter((s) => s.id !== id));
      startTransition(() => router.refresh());
    } finally {
      setBusyId(null);
    }
  }

  async function revokeAllOthers() {
    if (busyId || busyAll) return;
    setBusyAll(true);
    setErr(null);
    try {
      const res = await fetch("/api/account/sessions", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ allOthers: true })
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErr(json.error ?? labels.error);
        return;
      }
      setSessions((cur) => cur.filter((s) => s.isCurrent));
      startTransition(() => router.refresh());
    } finally {
      setBusyAll(false);
    }
  }

  return (
    <div className="space-y-4">
      {sessions.length === 0 ? (
        <p className="text-sm text-ink-grey">{labels.empty}</p>
      ) : (
        <ul className="divide-y divide-[var(--c-border,#cecece)] rounded-lg border border-[var(--c-border,#cecece)] overflow-hidden bg-[var(--c-surface,#ffffff)]">
          {sessions.map((s) => {
            const desc = describe(s.userAgent, labels.browserFallback);
            const Icon = UA_PATTERNS.find((p) => p.match.test(s.userAgent ?? ""))?.icon ?? Monitor;
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <Icon size={20} className="text-ink-grey shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">
                    {desc.os} {desc.browser && <span className="text-ink-grey font-normal">· {desc.browser}</span>}
                    {s.isCurrent && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--c-tag-green-bg,#c9e8a0)] text-[var(--c-tag-green-text,#005a25)]">
                        {labels.currentLabel}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-grey tabular-nums">{s.lastSeenLabel}</p>
                  <p className="text-xs text-ink-grey tabular-nums">
                    {s.expiresOnLabel}
                    {s.ipAddress && (
                      <span className="ml-2 font-mono">{s.ipAddress}</span>
                    )}
                  </p>
                </div>
                {!s.isCurrent && (
                  <button
                    type="button"
                    onClick={() => revokeOne(s.id)}
                    disabled={busyId === s.id || busyAll}
                    aria-label={labels.revoke}
                    className="p-2 text-ink-grey hover:text-[var(--c-ink-red,#ed2b00)] disabled:opacity-50 transition-colors"
                  >
                    {busyId === s.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} aria-hidden="true" />
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {otherCount > 0 && (
        <button
          type="button"
          onClick={revokeAllOthers}
          disabled={busyAll}
          className="inline-flex items-center gap-2 text-sm text-[var(--c-ink-red,#ed2b00)] hover:underline disabled:opacity-50"
        >
          {busyAll && <Loader2 size={14} className="animate-spin" />}
          {labels.revokeOthers} ({otherCount})
        </button>
      )}

      {err && <p className="text-sm text-[var(--c-ink-red,#ed2b00)]">{labels.error}: {err}</p>}

      <div className="pt-2">
        <Link
          href="/account"
          className="inline-flex items-center gap-1 text-sm text-ink-grey hover:text-ink"
        >
          ← {labels.backLink}
        </Link>
      </div>
    </div>
  );
}
