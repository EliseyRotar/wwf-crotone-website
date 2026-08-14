"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Pencil, X, Eye, EyeOff } from "lucide-react";

type Post = {
  id: string; slug: string; titleIt: string; titleEn: string | null;
  excerptIt: string | null; contentIt: string; contentEn: string | null;
  published: boolean; publishedAt: string | null;
};

export default function BlogManager({ posts }: { posts: Post[] }) {
  const router = useRouter();
  const t = useTranslations("Admin.blog");
  const tC = useTranslations("Admin.common");
  const [editing, setEditing] = useState<Post | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ titleIt: "", titleEn: "", excerptIt: "", contentIt: "", contentEn: "", published: false });
  const [busy, setBusy] = useState(false);

  const startCreate = () => { setCreating(true); setEditing(null); setForm({ titleIt: "", titleEn: "", excerptIt: "", contentIt: "", contentEn: "", published: false }); };
  const startEdit = (p: Post) => {
    setEditing(p); setCreating(false);
    setForm({ titleIt: p.titleIt, titleEn: p.titleEn || "", excerptIt: p.excerptIt || "", contentIt: p.contentIt, contentEn: p.contentEn || "", published: p.published });
  };

  const save = async () => {
    setBusy(true);
    try {
      if (creating) {
        await fetch("/api/blog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      } else if (editing) {
        await fetch("/api/blog", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...form }) });
      }
      setEditing(null); setCreating(false); router.refresh();
    } finally { setBusy(false); }
  };

  const del = async (id: string) => {
    if (!confirm(t("delete"))) return;
    await fetch("/api/blog", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    router.refresh();
  };

  const togglePublish = async (p: Post) => {
    await fetch("/api/blog", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, published: !p.published }) });
    router.refresh();
  };

  const showForm = creating || editing;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl">{t("title")}</h1>
        {!showForm && <button onClick={startCreate} className="btn btn-green"><Plus size={18} /> {t("newPost")}</button>}
      </div>

      {showForm && (
        <div className="card mb-6">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg">{creating ? t("newArticle") : t("editArticle")}</h3>
              <button onClick={() => { setCreating(false); setEditing(null); }} className="text-[var(--ad-text-muted)] hover:text-[var(--ad-text)]"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div className="field"><label>{t("titleIt")}</label><input value={form.titleIt} onChange={(e) => setForm({ ...form, titleIt: e.target.value })} /></div>
              <div className="field"><label>{t("titleEn")}</label><input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} /></div>
              <div className="field"><label>{t("excerptIt")}</label><input value={form.excerptIt} onChange={(e) => setForm({ ...form, excerptIt: e.target.value })} /></div>
              <div className="field"><label>{t("contentIt")}</label><textarea value={form.contentIt} onChange={(e) => setForm({ ...form, contentIt: e.target.value })} rows={8} /></div>
              <div className="field"><label>{t("contentEn")}</label><textarea value={form.contentEn} onChange={(e) => setForm({ ...form, contentEn: e.target.value })} rows={8} /></div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
                {t("published")}
              </label>
              <div className="flex gap-2"><button onClick={save} disabled={busy} className="btn btn-green">{busy ? tC("loading") : t("save")}</button>
              <button onClick={() => { setCreating(false); setEditing(null); }} className="btn btn-outline">{tC("cancel")}</button></div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {posts.length === 0 && <p className="text-[var(--ad-text-muted)]">{t("noPosts")}</p>}
        {posts.map((p) => (
          <div key={p.id} className="flex items-center justify-between p-3 bg-surface border border-[var(--ad-border)]">
            <div>
              <p className="font-bold">{p.titleIt} {p.titleEn && <span className="text-xs text-[var(--ad-text-muted)]">/ {p.titleEn}</span>}</p>
              <p className="text-xs text-[var(--ad-text-muted)]">/{p.slug} — {p.published ? t("published") : t("draft")}</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => togglePublish(p)} className="p-2 text-[var(--ad-text)] hover:text-[var(--ad-accent)]" title={p.published ? t("unpublish") : t("publish")}>
                {p.published ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button onClick={() => startEdit(p)} className="p-2 text-[var(--ad-text)] hover:text-[var(--ad-accent)]"><Pencil size={16} /></button>
              <button onClick={() => del(p.id)} className="p-2 text-[var(--ad-danger)] hover:bg-[var(--ad-danger-soft)]"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}