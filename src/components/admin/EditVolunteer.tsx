"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil, X } from "lucide-react";

type Iscrizione = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  age: number | null;
  email: string;
  phone: string;
  isMinor: boolean;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  allergies: string | null;
  medications: string | null;
  swimmingAbility: string | null;
  tetanusStatus: string | null;
  fitnessSelf: string | null;
  dietaryNeeds: string | null;
  dietaryNotes: string | null;
  tshirtSize: string | null;
  arrivalMode: string | null;
  arrivalTime: string | null;
  departureTime: string | null;
  status: string;
  feePaid: boolean;
  balancePaid: boolean;
  notes: string | null;
  imageDataConsent: boolean;
};

export default function EditVolunteer({ iscrizione }: { iscrizione: Iscrizione }) {
  const router = useRouter();
  const t = useTranslations("Admin.edit");
  const tVol = useTranslations("Admin.volunteer");
  const tIsc = useTranslations("Admin.iscrizioni");
  const tC = useTranslations("Admin.common");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          setOpen(false);
        }
        if (e.key === "Tab") {
          const root = document.getElementById("edit-volunteer-modal");
          if (!root) return;
          const focusable = root.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };
      document.addEventListener("keydown", onKey);
      const root = document.getElementById("edit-volunteer-modal");
      const firstInput = root?.querySelector<HTMLElement>("input, select, textarea, button");
      firstInput?.focus();
      return () => {
        document.body.style.overflow = "";
        document.removeEventListener("keydown", onKey);
      };
    }
  }, [open]);

  const close = () => setOpen(false);

  const [data, setData] = useState<Record<string, string | boolean>>({
    firstName: iscrizione.firstName,
    lastName: iscrizione.lastName,
    birthDate: iscrizione.birthDate ? iscrizione.birthDate.slice(0, 10) : "",
    email: iscrizione.email,
    phone: iscrizione.phone,
    isMinor: iscrizione.isMinor,
    guardianName: iscrizione.guardianName || "",
    guardianEmail: iscrizione.guardianEmail || "",
    guardianPhone: iscrizione.guardianPhone || "",
    allergies: iscrizione.allergies || "",
    medications: iscrizione.medications || "",
    swimmingAbility: iscrizione.swimmingAbility || "",
    tetanusStatus: iscrizione.tetanusStatus || "",
    fitnessSelf: iscrizione.fitnessSelf || "",
    dietaryNeeds: iscrizione.dietaryNeeds || "none",
    dietaryNotes: iscrizione.dietaryNotes || "",
    tshirtSize: iscrizione.tshirtSize || "",
    arrivalMode: iscrizione.arrivalMode || "",
    arrivalTime: iscrizione.arrivalTime || "",
    departureTime: iscrizione.departureTime || "",
    status: iscrizione.status,
    feePaid: iscrizione.feePaid,
    balancePaid: iscrizione.balancePaid,
    notes: iscrizione.notes || "",
    imageDataConsent: iscrizione.imageDataConsent
  });

  const set = (k: string, v: string | boolean) => setData((d) => ({ ...d, [k]: v }));

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/iscrizioni/manual", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: iscrizione.id, ...data })
      });
      const json = await res.json();
      if (json.ok) {
        close();
        router.refresh();
      } else {
        setErr(t("error") + ": " + (json.error || tC("unknown")));
      }
    } catch {
      setErr(t("networkError"));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-ink hover:text-wwf-green p-1"
        aria-label={t("title")}
        title={t("title")}
      >
        <Pencil size={15} />
      </button>
    );
  }

  return createPortal(
    <>
      {/* Modal overlay */}
      <div
        className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4"
        onClick={close}
      >
        <div
          id="edit-volunteer-modal"
          role="dialog"
          aria-modal="true"
          aria-label={t("title")}
          className="card bg-surface max-w-2xl w-full max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 pb-4 border-b border-ink-grey-light shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xl">{t("title")}</h2>
              <button onClick={close} className="text-ink-grey hover:text-ink">
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto">
            <div className="grid sm:grid-cols-2 gap-x-4">
              <div className="field">
                <label>{t("firstName")}</label>
                <input value={String(data.firstName)} onChange={(e) => set("firstName", e.target.value)} />
              </div>
              <div className="field">
                <label>{t("lastName")}</label>
                <input value={String(data.lastName)} onChange={(e) => set("lastName", e.target.value)} />
              </div>
              <div className="field">
                <label>{t("birthDate")}{iscrizione.age !== null && !iscrizione.birthDate && ` (${t("birthDateAgeOnly")})`}</label>
                <input type="date" value={String(data.birthDate)} onChange={(e) => set("birthDate", e.target.value)} />
                {iscrizione.age !== null && !iscrizione.birthDate && (
                  <p className="text-xs text-ink-grey mt-1">{t("birthDateHint", { age: iscrizione.age })}</p>
                )}
              </div>
              <div className="field">
                <label>{tIsc("email")}</label>
                <input type="email" value={String(data.email)} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div className="field">
                <label>{tIsc("phone")}</label>
                <input type="tel" value={String(data.phone)} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div className="field">
                <label>{t("status")}</label>
                <select value={String(data.status)} onChange={(e) => set("status", e.target.value)}>
                  <option value="pending">{tIsc("statusPending")}</option>
                  <option value="confirmed">{tIsc("statusConfirmed")}</option>
                  <option value="paid">{tIsc("statusPaid")}</option>
                  <option value="waitlist">{tIsc("statusWaitlist")}</option>
                  <option value="cancelled">{tIsc("statusCancelled")}</option>
                </select>
              </div>
              <div className="field">
                <label>{t("dietLabel")}</label>
                <select value={String(data.dietaryNeeds)} onChange={(e) => set("dietaryNeeds", e.target.value)}>
                  <option value="none">{tC("none")}</option>
                  <option value="vegetarian">{tVol("dietaryNeeds") === "Esigenze" ? "Vegetariano" : "Vegetarian"}</option>
                  <option value="vegan">{tVol("dietaryNeeds") === "Esigenze" ? "Vegano" : "Vegan"}</option>
                  <option value="celiac">{tVol("dietaryNeeds") === "Esigenze" ? "Celiaco" : "Celiac"}</option>
                  <option value="other">{tVol("dietaryNeeds") === "Esigenze" ? "Altra" : "Other"}</option>
                </select>
              </div>
              <div className="field">
                <label>{t("tshirt")}</label>
                <select value={String(data.tshirtSize)} onChange={(e) => set("tshirtSize", e.target.value)}>
                  <option value="">—</option>
                  {["S", "M", "L", "XL", "XXL"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label>{tVol("allergies")}</label>
                <input value={String(data.allergies)} onChange={(e) => set("allergies", e.target.value)} />
              </div>
              <div className="field">
                <label>{tVol("medications")}</label>
                <input value={String(data.medications)} onChange={(e) => set("medications", e.target.value)} />
              </div>
              <div className="field">
                <label>{t("arrivalSection")}</label>
                <select value={String(data.arrivalMode)} onChange={(e) => set("arrivalMode", e.target.value)}>
                  <option value="">—</option>
                  <option value="own_car">{t("ownCar")}</option>
                  <option value="train">{t("train")}</option>
                  <option value="bus">{t("bus")}</option>
                  <option value="plane_crotone">{t("planeCrotone")}</option>
                  <option value="plane_lamezia">{t("planeLamezia")}</option>
                  <option value="need_pickup">{t("pickup")}</option>
                </select>
              </div>
              <div className="field">
                <label>{tVol("arrivalTime")}</label>
                <input type="time" value={String(data.arrivalTime)} onChange={(e) => set("arrivalTime", e.target.value)} />
              </div>
              <div className="field">
                <label>{tVol("departureTime")}</label>
                <input type="time" value={String(data.departureTime)} onChange={(e) => set("departureTime", e.target.value)} />
              </div>
              <div className="field">
                <label>{t("guardianSection")}</label>
                <input value={String(data.guardianName)} onChange={(e) => set("guardianName", e.target.value)} />
              </div>
              <div className="field">
                <label>{tVol("guardianPhone")}</label>
                <input type="tel" value={String(data.guardianPhone)} onChange={(e) => set("guardianPhone", e.target.value)} />
              </div>
              <div className="field sm:col-span-2">
                <label>{t("adminNotes")}</label>
                <input value={String(data.notes)} onChange={(e) => set("notes", e.target.value)} />
              </div>
              <div className="field sm:col-span-2 flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(data.feePaid)} onChange={(e) => set("feePaid", e.target.checked)} />
                  {tVol("quotaPaid")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(data.balancePaid)} onChange={(e) => set("balancePaid", e.target.checked)} />
                  {tVol("balancePaid")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(data.imageDataConsent)} onChange={(e) => set("imageDataConsent", e.target.checked)} />
                  {tIsc("imageConsent")}
                </label>
              </div>
            </div>

            {err && <p className="field-error mt-3">{err}</p>}

            <div className="flex gap-2 mt-4">
              <button onClick={save} disabled={busy} className="btn btn-green">
                {busy ? tC("loading") : t("save")}
              </button>
              <button onClick={close} className="btn btn-outline">
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}