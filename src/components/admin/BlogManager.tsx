"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, X, Eye, EyeOff } from "lucide-react";

type Post = {
  id: string; slug: string; titleIt: string; titleEn: string | null;
  excerptIt: string | null; contentIt: string; contentEn: string | null;
  published: boolean; publishedAt: string | null;
};

export default function BlogManager({ posts }: { posts: Post[] }) {
  const router = useRouter();
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
    if (!confirm("Eliminare questo articolo?")) return;
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
        <h1 className="text-3xl">Blog</h1>
        {!showForm && <button onClick={startCreate} className="btn btn-green"><Plus size={18} /> Nuovo articolo</button>}
      </div>

      {showForm && (
        <div className="card mb-6">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg">{creating ? "Nuovo articolo" : "Modifica articolo"}</h3>
              <button onClick={() => { setCreating(false); setEditing(null); }} className="text-ink-grey hover:text-ink"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div className="field"><label>Titolo (IT) *</label><input value={form.titleIt} onChange={(e) => setForm({ ...form, titleIt: e.target.value })} /></div>
              <div className="field"><label>Titolo (EN)</label><input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} /></div>
              <div className="field"><label>Riassunto (IT)</label><input value={form.excerptIt} onChange={(e) => setForm({ ...form, excerptIt: e.target.value })} /></div>
              <div className="field"><label>Contenuto (IT) *</label><textarea value={form.contentIt} onChange={(e) => setForm({ ...form, contentIt: e.target.value })} rows={8} /></div>
              <div className="field"><label>Contenuto (EN)</label><textarea value={form.contentEn} onChange={(e) => setForm({ ...form, contentEn: e.target.value })} rows={8} /></div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
                Pubblicato
              </label>
              <div className="flex gap-2"><button onClick={save} disabled={busy} className="btn btn-green">{busy ? "…" : "Salva"}</button>
              <button onClick={() => { setCreating(false); setEditing(null); }} className="btn btn-outline">Annulla</button></div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {posts.length === 0 && <p className="text-ink-grey">Nessun articolo.</p>}
        {posts.map((p) => (
          <div key={p.id} className="flex items-center justify-between p-3 bg-surface border border-ink-grey-light">
            <div>
              <p className="font-bold">{p.titleIt} {p.titleEn && <span className="text-xs text-ink-grey">/ {p.titleEn}</span>}</p>
              <p className="text-xs text-ink-grey">/{p.slug} — {p.published ? "Pubblicato" : "Bozza"}</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => togglePublish(p)} className="p-2 text-ink hover:text-wwf-green" title={p.published ? "Nascondi" : "Pubblica"}>
                {p.published ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button onClick={() => startEdit(p)} className="p-2 text-ink hover:text-wwf-green"><Pencil size={16} /></button>
              <button onClick={() => del(p.id)} className="p-2 text-wwf-red hover:bg-wwf-red/10"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}