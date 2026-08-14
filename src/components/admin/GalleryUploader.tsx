"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Upload, Trash2 } from "lucide-react";

export default function GalleryUploader({ items }: { items: { id: string; titleIt: string; category: string }[] }) {
  const router = useRouter();
  const t = useTranslations("Admin.gallery");
  const tC = useTranslations("Admin.common");
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
        setMsg(tC("uploaded") + ": " + json.path);
        if (!titleIt) setTitleIt(f.name.replace(/\.[^.]+$/, ""));
      } else {
        setMsg(tC("error") + " upload: " + json.error);
      }
    } catch {
      setMsg(tC("networkError"));
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
        setMsg(tC("addedToGallery"));
        router.refresh();
      } else {
        setMsg(tC("error") + ": " + json.error);
      }
    } finally {
      setBusy(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm(t("delete"))) return;
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
          <h2 className="font-head text-xl text-[var(--ad-text)] mb-4">{t("addItem")}</h2>
          <form onSubmit={submit} className="space-y-3">
            <div className="field">
              <label>{t("type")}</label>
              <select value={type} onChange={(e) => setType(e.target.value as "image" | "video")}>
                <option value="image">{t("image")}</option>
                <option value="video">{t("video")}</option>
              </select>
            </div>
            {type === "image" ? (
              <div className="field">
                <label>{t("file")}</label>
                <input type="file" accept="image/*" onChange={onFile} />
                {src && <p className="text-xs text-[var(--ad-accent)] mt-1">{src}</p>}
              </div>
            ) : (
              <>
                <div className="field">
                  <label>{t("youtubeId")}</label>
                  <input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="es. dQw4w9WgXcQ" />
                </div>
                <div className="field">
                  <label>{t("thumbnail")}</label>
                  <input value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} />
                </div>
              </>
            )}
            <div className="field">
              <label>{t("titleIt")}</label>
              <input value={titleIt} onChange={(e) => setTitleIt(e.target.value)} required />
            </div>
            <div className="field">
              <label>{t("titleEn")}</label>
              <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
            </div>
            <div className="field">
              <label>{t("captionIt")}</label>
              <input value={captionIt} onChange={(e) => setCaptionIt(e.target.value)} />
            </div>
            <div className="field">
              <label>{t("captionEn")}</label>
              <input value={captionEn} onChange={(e) => setCaptionEn(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label>{t("category")}</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <label>{t("year")}</label>
                <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
              </div>
            </div>
            {msg && <p className="text-sm text-[var(--ad-text-muted)]">{msg}</p>}
            <button type="submit" disabled={busy} className="btn btn-green">
              <Upload size={18} /> {busy ? tC("loading") : t("publish")}
            </button>
          </form>
        </div>
      </div>

      <div>
        <h2 className="font-head text-xl text-[var(--ad-text)] mb-4">{t("existingItems")} ({items.length})</h2>
        <div className="space-y-2 max-h-[40rem] overflow-y-auto">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between p-3 bg-surface border border-[var(--ad-border)]">
              <div className="min-w-0">
                <p className="font-bold truncate">{it.titleIt}</p>
                <p className="text-xs text-[var(--ad-text-muted)]">{it.category}</p>
              </div>
              <button onClick={() => del(it.id)} className="text-[var(--ad-danger)] hover:bg-[var(--ad-danger-soft)] p-2" aria-label={tC("delete")}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}