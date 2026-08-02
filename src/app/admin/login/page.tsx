"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogIn } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const t = useTranslations("Admin.login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const json = await res.json();
      if (json.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setErr(json.error === "invalid" ? t("invalid") : t("error"));
      }
    } catch {
      setErr(t("networkError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm card">
      <div className="card-body">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/wwf.png" alt="WWF" className="h-14 mb-4 rounded-sm bg-white p-1.5" />
        <h1 className="text-2xl mb-1">{t("title")}</h1>
        <p className="text-sm text-ink-grey mb-6">{t("subtitle")}</p>
        <form onSubmit={submit} className="space-y-3">
          <div className="field">
            <label htmlFor="email">{t("email")}</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="pw">{t("password")}</label>
            <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {err && <p className="field-error" role="alert">{err}</p>}
          <button type="submit" disabled={loading} className="btn btn-green w-full">
            <LogIn size={18} /> {loading ? t("loading") : t("submit")}
          </button>
        </form>
      </div>
    </div>
  );
}