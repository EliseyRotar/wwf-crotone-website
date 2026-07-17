"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Trash2 } from "lucide-react";

export default function GalleryUploader({ items }: { items: { id: string; titleIt: string; category: string }[] }) {
  const router = useRouter();
  const [type, setType] = useState<"image" | "video">("image");
  const [src, setSrc] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [titleIt, setTitleIt] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [captionIt, setCaptionIt] = useState("");
  const [captionEn, setCaptionEn] = useState("");
  const [category, setCategory] = useState("campo");
  const [year, setYear] = useState(2026);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (json.ok) {
        setSrc(json.path);
        setMsg("File caricato: " + json.path);
        if (!titleIt) setTitleIt(f.name.replace(/\.[^.]+$/, ""));
      } else {
        setMsg("Errore upload: " + json.error);
      }
    } catch {
      setMsg("Errore di rete");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (type === "video" && !src) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, src, thumbnail, titleIt, titleEn, captionIt, captionEn, category, year })
      });
      const json = await res.json();
      if (json.ok) {
        setSrc(""); setTitleIt(""); setTitleEn(""); setCaptionIt(""); setCaptionEn("");
        setMsg("Aggiunto alla galleria.");
        router.refresh();
      } else {
        setMsg("Errore: " + json.error);
      }
    } finally {
      setBusy(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm("Eliminare questo elemento?")) return;
    await fetch("/api/admin/gallery", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    router.refresh();
  };

  const cats = ["tartarughe", "cleanup", "wildlife", "campo", "schiuse", "cultura", "crtm", "tartamar", "turtledog"];

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div className="card">
        <div className="card-body">
          <h2 className="text-xl mb-4">Aggiungi elemento</h2>
          <form onSubmit={submit} className="space-y-3">
            <div className="field">
              <label>Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value as "image" | "video")}>
                <option value="image">Immagine</option>
                <option value="video">Video (YouTube ID)</option>
              </select>
            </div>
            {type === "image" ? (
              <div className="field">
                <label>File</label>
                <input type="file" accept="image/*" onChange={onFile} />
                {src && <p className="text-xs text-wwf-green mt-1">{src}</p>}
              </div>
            ) : (
              <>
                <div className="field">
                  <label>YouTube video ID</label>
                  <input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="es. dQw4w9WgXcQ" />
                </div>
                <div className="field">
                  <label>Thumbnail URL (opzionale)</label>
                  <input value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} />
                </div>
              </>
            )}
            <div className="field">
              <label>Titolo (IT) *</label>
              <input value={titleIt} onChange={(e) => setTitleIt(e.target.value)} required />
            </div>
            <div className="field">
              <label>Titolo (EN)</label>
              <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
            </div>
            <div className="field">
              <label>Didascalia (IT)</label>
              <input value={captionIt} onChange={(e) => setCaptionIt(e.target.value)} />
            </div>
            <div className="field">
              <label>Didascalia (EN)</label>
              <input value={captionEn} onChange={(e) => setCaptionEn(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label>Categoria</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Anno</label>
                <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
              </div>
            </div>
            {msg && <p className="text-sm text-ink-grey">{msg}</p>}
            <button type="submit" disabled={busy} className="btn btn-green">
              <Upload size={18} /> {busy ? "…" : "Pubblica"}
            </button>
          </form>
        </div>
      </div>

      <div>
        <h2 className="text-xl mb-4">Elementi esistenti ({items.length})</h2>
        <div className="space-y-2 max-h-[40rem] overflow-y-auto">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between p-3 bg-surface border border-ink-grey-light">
              <div className="min-w-0">
                <p className="font-bold truncate">{it.titleIt}</p>
                <p className="text-xs text-ink-grey">{it.category}</p>
              </div>
              <button onClick={() => del(it.id)} className="text-wwf-red hover:bg-wwf-red/10 p-2" aria-label="Elimina">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}