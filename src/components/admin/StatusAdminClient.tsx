"use client";
/**
 * StatusAdminClient — the interactive console for /admin/status.
 *
 * Three tabs:
 *   - Services: list/edit/soft-delete. Inline form for edit.
 *   - Incidents: create + post updates + resolve. New incident form
 *     at the top; active + recent lists below.
 *   - History: uptime matrix (24h/7d/30d per service). Read-only.
 *
 * All mutations go through the admin API routes added in
 * src/app/api/admin/status/*. The forms are intentionally minimal —
 * the goal is "works correctly" not "pretty", because this is an
 * internal tool used by ≤2 people.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Save, Trash2, RefreshCw, RotateCcw, CircleAlert, Activity } from "lucide-react";

type Service = {
  id: string;
  slug: string;
  name_it: string;
  name_en: string;
  category: string;
  source: string;
  source_id: string | null;
  url: string | null;
  active: boolean;
  display_order: number;
  uptime_7d: number | null;
  uptime_30d: number | null;
};

type Update = {
  id: string;
  status: string;
  body_it: string;
  body_en: string;
  created_at: string;
};

type Incident = {
  id: string;
  service_slug: string;
  severity: string;
  status: string;
  title_it: string;
  title_en: string;
  body_it: string;
  body_en: string;
  started_at: string;
  resolved_at: string | null;
  updates: Update[];
};

type Tab = "services" | "incidents" | "history";

export default function StatusAdminClient({
  locale,
  services: initialServices,
  activeIncidents: initialActive,
  recentIncidents: initialRecent,
}: {
  locale: string;
  services: Service[];
  activeIncidents: Incident[];
  recentIncidents: Incident[];
}) {
  const t = useTranslations("Admin.status");
  const [tab, setTab] = useState<Tab>("services");
  const [services, setServices] = useState<Service[]>(initialServices);
  const [active, setActive] = useState<Incident[]>(initialActive);
  const [recent, setRecent] = useState<Incident[]>(initialRecent);

  const refreshAll = async () => {
    const r = await fetch("/api/admin/status/services", { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      setServices(j.services);
    }
    const ir = await fetch("/api/admin/status/incidents?include_resolved=1", { cache: "no-store" });
    if (ir.ok) {
      const j = await ir.json();
      const all = j.incidents as Incident[];
      setActive(all.filter((i) => !i.resolved_at));
      setRecent(all.filter((i) => !!i.resolved_at));
    }
  };

  return (
    <div>
      <nav className="flex gap-2 mb-4 border-b border-[var(--ad-border)]">
        {(["services", "incidents", "history"] as Tab[]).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-2 text-sm font-bold text-[10px] font-semibold uppercase tracking-wider border-b-2 -mb-px transition-colors ${
              tab === k ? "border-[var(--ad-accent)] text-[var(--ad-accent)]" : "border-transparent text-[var(--ad-text-muted)] hover:text-[var(--ad-text)]"
            }`}
          >
            {t(`page.tab${k[0].toUpperCase()}${k.slice(1)}`)}
          </button>
        ))}
        <button
          onClick={() => void refreshAll()}
          className="ml-auto px-3 py-2 text-xs text-[var(--ad-text-muted)] hover:text-[var(--ad-text)]"
          aria-label="refresh"
        >
          <RefreshCw size={14} />
        </button>
      </nav>

      {tab === "services" && (
        <ServicesTab services={services} onChange={setServices} t={t} />
      )}
      {tab === "incidents" && (
        <IncidentsTab
          services={services}
          active={active}
          recent={recent}
          onChangeActive={setActive}
          onChangeRecent={setRecent}
          t={t}
        />
      )}
      {tab === "history" && <HistoryTab services={services} t={t} />}
    </div>
  );
}

function ServicesTab({
  services,
  onChange,
  t,
}: {
  services: Service[];
  onChange: (s: Service[]) => void;
  t: ReturnType<typeof useTranslations<"Admin.status">>;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  const toggleActive = async (s: Service) => {
    const method = s.active ? "DELETE" : "PATCH";
    const body = s.active ? undefined : JSON.stringify({ active: true });
    const r = await fetch(`/api/admin/status/services/${s.slug}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body,
    });
    if (r.ok) {
      onChange(services.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x)));
    }
  };

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-[10px] font-semibold uppercase tracking-wider text-[var(--ad-text-muted)] border-b border-[var(--ad-border)]">
            <th className="pb-2 pr-3">{t("services.table.name")}</th>
            <th className="pb-2 pr-3">{t("services.table.category")}</th>
            <th className="pb-2 pr-3">{t("services.table.source")}</th>
            <th className="pb-2 pr-3 text-right">{t("services.table.uptime")}</th>
            <th className="pb-2 pr-3 text-right">{t("services.table.uptime30d")}</th>
            <th className="pb-2 pr-3">{t("services.table.active")}</th>
            <th className="pb-2">{t("services.table.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.id} className="border-b border-[var(--ad-border)]">
              <td className="py-2 pr-3">
                <p className="font-semibold">{s.name_it}</p>
                <p className="text-xs text-[var(--ad-text-muted)]">{s.slug}</p>
              </td>
              <td className="py-2 pr-3 text-xs">{categoryLabel(s.category, t)}</td>
              <td className="py-2 pr-3 text-xs">{sourceLabel(s.source, t)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {s.uptime_7d === null ? "—" : `${s.uptime_7d.toFixed(2)}%`}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {s.uptime_30d === null ? "—" : `${s.uptime_30d.toFixed(2)}%`}
              </td>
              <td className="py-2 pr-3">
                <span className={`inline-block h-2 w-2 rounded-full ${s.active ? "bg-emerald-500" : "bg-slate-400"}`} />
              </td>
              <td className="py-2">
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditing(editing === s.slug ? null : s.slug)}
                    className="px-2 py-1 text-xs rounded hover:bg-[var(--ad-bg)]/5"
                    title={t("services.edit")}
                  >
                    {t("services.edit")}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(s.active ? t("services.confirmDeactivate") : t("services.confirmReactivate"))) {
                        void toggleActive(s);
                      }
                    }}
                    className="px-2 py-1 text-xs rounded hover:bg-[var(--ad-bg)]/5"
                    title={s.active ? t("services.deactivate") : t("services.reactivate")}
                  >
                    {s.active ? <Trash2 size={12} /> : <RotateCcw size={12} />}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && <ServiceEditForm slug={editing} services={services} onSaved={(next) => {
        onChange(services.map((x) => (x.slug === next.slug ? next : x)));
        setEditing(null);
      }} t={t} />}
    </div>
  );
}

function ServiceEditForm({
  slug,
  services,
  onSaved,
  t,
}: {
  slug: string;
  services: Service[];
  onSaved: (s: Service) => void;
  t: ReturnType<typeof useTranslations<"Admin.status">>;
}) {
  const s = services.find((x) => x.slug === slug);
  const [name_it, setName_it] = useState(s?.name_it ?? "");
  const [name_en, setName_en] = useState(s?.name_en ?? "");
  const [url, setUrl] = useState(s?.url ?? "");
  const [display_order, setOrder] = useState(s?.display_order ?? 0);
  const [saving, setSaving] = useState(false);

  if (!s) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/status/services/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name_it, name_en, url: url || null, display_order }),
      });
      if (r.ok) {
        const j = await r.json();
        onSaved({ ...s, ...j.service });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="mt-4 card p-4">
      <h3 className="font-bold mb-3">{t("services.edit")} {s.slug}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="name_it" value={name_it} onChange={setName_it} />
        <Field label="name_en" value={name_en} onChange={setName_en} />
        <Field label="url" value={url} onChange={setUrl} />
        <Field label="display_order" value={String(display_order)} onChange={(v) => setOrder(Number(v) || 0)} />
      </div>
      <div className="flex gap-2 mt-3">
        <button type="submit" disabled={saving} className="btn btn-green inline-flex items-center gap-1">
          <Save size={14} /> {t("services.save")}
        </button>
      </div>
    </form>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs">
      <span className="block text-[var(--ad-text-muted)] mb-1">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-[var(--ad-border-strong)] rounded text-sm"
      />
    </label>
  );
}

function IncidentsTab({
  services,
  active,
  recent,
  onChangeActive,
  onChangeRecent,
  t,
}: {
  services: Service[];
  active: Incident[];
  recent: Incident[];
  onChangeActive: (i: Incident[]) => void;
  onChangeRecent: (i: Incident[]) => void;
  t: ReturnType<typeof useTranslations<"Admin.status">>;
}) {
  return (
    <div className="space-y-6">
      <NewIncidentForm services={services} onCreated={(inc) => onChangeActive([inc, ...active])} t={t} />

      <section>
        <h3 className="text-sm font-bold text-[10px] font-semibold uppercase tracking-wider text-[var(--ad-text-muted)] mb-2">
          {t("incidents.active")} ({active.length})
        </h3>
        {active.length === 0 ? (
          <p className="text-sm text-[var(--ad-text-muted)]">{t("incidents.noActive")}</p>
        ) : (
          <div className="space-y-3">
            {active.map((inc) => (
              <IncidentCard
                key={inc.id}
                incident={inc}
                onResolved={() => onChangeActive(active.filter((i) => i.id !== inc.id))}
                onUpdate={(u) => onChangeActive(active.map((i) => (i.id === inc.id ? { ...i, updates: [u, ...i.updates] } : i)))}
                t={t}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-bold text-[10px] font-semibold uppercase tracking-wider text-[var(--ad-text-muted)] mb-2">
          {t("incidents.recent")} ({recent.length})
        </h3>
        {recent.length === 0 ? (
          <p className="text-sm text-[var(--ad-text-muted)]">{t("incidents.noRecent")}</p>
        ) : (
          <div className="space-y-2 opacity-80">
            {recent.slice(0, 10).map((inc) => (
              <IncidentSummary key={inc.id} incident={inc} t={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function NewIncidentForm({
  services,
  onCreated,
  t,
}: {
  services: Service[];
  onCreated: (i: Incident) => void;
  t: ReturnType<typeof useTranslations<"Admin.status">>;
}) {
  const [service_slug, setService] = useState(services[0]?.slug ?? "");
  const [severity, setSeverity] = useState("minor");
  const [title_it, setTitle_it] = useState("");
  const [title_en, setTitle_en] = useState("");
  const [body_it, setBody_it] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service_slug || !title_it.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/status/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_slug, severity, title_it, title_en: title_en || title_it, body_it }),
      });
      if (r.ok) {
        const j = await r.json();
        const inc = j.incident as { id: string; service_id: string; severity: string; status: string; title_it: string; title_en: string; body_it: string; body_en: string; started_at: string; resolved_at: string | null };
        onCreated({
          ...inc,
          service_slug,
          updates: [],
        });
        setTitle_it("");
        setTitle_en("");
        setBody_it("");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-4">
      <h3 className="font-bold mb-3 inline-flex items-center gap-2"><CircleAlert size={14} /> {t("incidents.new")}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="block text-xs">
          <span className="block text-[var(--ad-text-muted)] mb-1">{t("incidents.fields.service")}</span>
          <select value={service_slug} onChange={(e) => setService(e.target.value)} className="w-full px-2 py-1.5 border border-[var(--ad-border-strong)] rounded text-sm">
            {services.filter((s) => s.active).map((s) => (
              <option key={s.slug} value={s.slug}>{s.name_it}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="block text-[var(--ad-text-muted)] mb-1">{t("incidents.fields.severity")}</span>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full px-2 py-1.5 border border-[var(--ad-border-strong)] rounded text-sm">
            <option value="minor">{severityLabel("minor", t)}</option>
            <option value="major">{severityLabel("major", t)}</option>
            <option value="critical">{severityLabel("critical", t)}</option>
          </select>
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <Field label="title_it" value={title_it} onChange={setTitle_it} />
        <Field label="title_en" value={title_en} onChange={setTitle_en} />
      </div>
      <label className="block text-xs mt-3">
        <span className="block text-[var(--ad-text-muted)] mb-1">body_it</span>
        <textarea
          value={body_it}
          onChange={(e) => setBody_it(e.target.value)}
          rows={3}
          className="w-full px-2 py-1.5 border border-[var(--ad-border-strong)] rounded text-sm"
        />
      </label>
      <button type="submit" disabled={saving} className="btn btn-green inline-flex items-center gap-1 mt-3">
        <Plus size={14} /> {t("services.save")}
      </button>
    </form>
  );
}

function IncidentCard({
  incident,
  onResolved,
  onUpdate,
  t,
}: {
  incident: Incident;
  onResolved: () => void;
  onUpdate: (u: Update) => void;
  t: ReturnType<typeof useTranslations<"Admin.status">>;
}) {
  const [message_it, setMessage] = useState("");
  const [posting, setPosting] = useState(false);

  const resolve = async () => {
    if (!confirm(t("incidents.confirmResolve"))) return;
    const r = await fetch(`/api/admin/status/incidents/${incident.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved_at: new Date().toISOString() }),
    });
    if (r.ok) onResolved();
  };
  const postUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message_it.trim()) return;
    setPosting(true);
    try {
      const r = await fetch(`/api/admin/status/incidents/${incident.id}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_it, status: "monitoring" }),
      });
      if (r.ok) {
        const j = await r.json();
        const u = j.update as { id: string; status: string; body_it: string; body_en: string; createdAt: Date };
        onUpdate({ id: u.id, status: u.status, body_it: u.body_it, body_en: u.body_en, created_at: new Date(u.createdAt).toISOString() });
        setMessage("");
      }
    } finally {
      setPosting(false);
    }
  };

  return (
    <article className="card p-4">
      <header className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900">
              {incident.severity}
            </span>
            <span className="text-xs text-[var(--ad-text-muted)]">{incident.status}</span>
          </div>
          <p className="font-semibold mt-1">{incident.title_it}</p>
          <p className="text-xs text-[var(--ad-text-muted)]">{incident.service_slug} · {new Date(incident.started_at).toLocaleString()}</p>
        </div>
        <button onClick={() => void resolve()} className="btn btn-green text-xs">
          {t("incidents.resolve")}
        </button>
      </header>

      {incident.updates.length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-[var(--ad-text-muted)] cursor-pointer">
            {t("incidents.updates.title")} ({incident.updates.length})
          </summary>
          <ol className="mt-2 space-y-1 border-l-2 border-[var(--ad-border)] pl-3 text-xs">
            {incident.updates.map((u) => (
              <li key={u.id}>
                <p className="text-[var(--ad-text-muted)]">{new Date(u.created_at).toLocaleString()}</p>
                <p>{u.body_it}</p>
              </li>
            ))}
          </ol>
        </details>
      )}

      <form onSubmit={postUpdate} className="mt-3 flex gap-2">
        <input
          value={message_it}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("incidents.updates.message_it")}
          className="flex-1 px-2 py-1.5 border border-[var(--ad-border-strong)] rounded text-sm"
        />
        <button type="submit" disabled={posting} className="btn btn-outline inline-flex items-center gap-1 text-xs">
          <Activity size={12} /> {t("incidents.updates.submit")}
        </button>
      </form>
    </article>
  );
}

function IncidentSummary({ incident, t }: { incident: Incident; t: ReturnType<typeof useTranslations<"Admin.status">> }) {
  return (
    <div className="border-b border-[var(--ad-border)] py-2 text-sm">
      <p className="font-medium">{incident.title_it}</p>
      <p className="text-xs text-[var(--ad-text-muted)]">
        {incident.service_slug} · {incident.severity} · {new Date(incident.resolved_at!).toLocaleString()}
      </p>
    </div>
  );
}

function HistoryTab({
  services,
  t,
}: {
  services: Service[];
  t: ReturnType<typeof useTranslations<"Admin.status">>;
}) {
  return (
    <div>
      <p className="text-sm text-[var(--ad-text-muted)] mb-3">
        Uptime % calculated by replaying StatusPeriod rows. Read-only — see <code>src/lib/status.ts</code>.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-[10px] font-semibold uppercase tracking-wider text-[var(--ad-text-muted)] border-b border-[var(--ad-border)]">
            <th className="pb-2 pr-3">{t("services.table.name")}</th>
            <th className="pb-2 pr-3 text-right">{t("services.table.uptime")}</th>
            <th className="pb-2 pr-3 text-right">{t("services.table.uptime30d")}</th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.id} className="border-b border-[var(--ad-border)]">
              <td className="py-2 pr-3">
                <p className="font-semibold">{s.name_it}</p>
                <p className="text-xs text-[var(--ad-text-muted)]">{s.slug}</p>
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {s.uptime_7d === null ? "—" : `${s.uptime_7d.toFixed(2)}%`}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {s.uptime_30d === null ? "—" : `${s.uptime_30d.toFixed(2)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function categoryLabel(category: string, t: ReturnType<typeof useTranslations<"Admin.status">>) {
  try {
    return t(`categories.${category}` as `categories.${string}`);
  } catch {
    return category;
  }
}

function sourceLabel(source: string, t: ReturnType<typeof useTranslations<"Admin.status">>) {
  try {
    return t(`sources.${source}` as `sources.${string}`);
  } catch {
    return source;
  }
}

function severityLabel(sev: "minor" | "major" | "critical", t: ReturnType<typeof useTranslations<"Admin.status">>) {
  // The severity.* keys live in the top-level Status namespace (it's
  // shared with the public page). We don't want to duplicate them
  // here, so we render the Italian/English literal directly.
  return t(`severity.${sev}` as "severity.minor" | "severity.major" | "severity.critical");
}
