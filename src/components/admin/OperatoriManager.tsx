"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserPlus, Pencil, X } from "lucide-react";

type Operatore = {
  id: string;
  firstName: string;
  lastName: string;
  sex: string | null;
  role: string;
  email: string | null;
  phone: string | null;
  assignedTurns: string | null;
  notes: string | null;
};

type Turno = { id: string; number: number };

const ROLE_LABELS: Record<string, string> = {
  coordinatore: "Coordinatore",
  operatore: "Operatore",
  tecnico: "Tecnico",
  chef: "Chef"
};

const ROLE_COLORS: Record<string, string> = {
  coordinatore: "tag-green",
  operatore: "tag-blue",
  tecnico: "tag-orange",
  chef: "tag-red"
};

const ALL_ROLES = ["operatore", "coordinatore", "tecnico", "chef"];

type FormData = {
  firstName: string;
  lastName: string;
  sex: string;
  role: string;
  email: string;
  phone: string;
  notes: string;
  assigned: string[];
};

const emptyForm: FormData = {
  firstName: "", lastName: "", sex: "M", role: "operatore",
  email: "", phone: "", notes: "", assigned: []
};

export default function OperatoriManager({
  operatori,
  turni
}: {
  operatori: Operatore[];
  turni: Turno[];
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof FormData, v: string | string[]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleTurno = (id: string) =>
    setForm((f) => ({
      ...f,
      assigned: f.assigned.includes(id) ? f.assigned.filter((x) => x !== id) : [...f.assigned, id]
    }));

  const resetForm = () => {
    setForm(emptyForm);
    setErr(null);
  };

  const startEdit = (op: Operatore) => {
    setEditId(op.id);
    setShowAdd(false);
    setForm({
      firstName: op.firstName,
      lastName: op.lastName,
      sex: op.sex || "M",
      role: op.role,
      email: op.email || "",
      phone: op.phone || "",
      notes: op.notes || "",
      assigned: op.assignedTurns ? op.assignedTurns.split(",").filter(Boolean) : []
    });
    setErr(null);
  };

  const startAdd = () => {
    setShowAdd(true);
    setEditId(null);
    resetForm();
  };

  const cancel = () => {
    setShowAdd(false);
    setEditId(null);
    resetForm();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName) {
      setErr("Nome obbligatorio");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        sex: form.sex,
        role: form.role,
        email: form.email,
        phone: form.phone,
        assignedTurns: form.assigned.join(","),
        notes: form.notes
      };

      if (editId) {
        // Edit existing
        const res = await fetch("/api/admin/operatori", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editId, ...payload })
        });
        const json = await res.json();
        if (!json.ok) { setErr("Errore: " + (json.error || "unknown")); return; }
      } else {
        // Add new
        const res = await fetch("/api/admin/operatori", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!json.ok) { setErr("Errore: " + (json.error || "unknown")); return; }
      }
      cancel();
      router.refresh();
    } catch {
      setErr("Errore di rete");
    } finally {
      setBusy(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm("Eliminare questo operatore?")) return;
    await fetch("/api/admin/operatori", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    router.refresh();
  };

  const turnNumbers = (op: Operatore): string => {
    if (!op.assignedTurns) return "—";
    const ids = op.assignedTurns.split(",").filter(Boolean);
    const nums = ids.map((id) => turni.find((t) => t.id === id)?.number).filter((n) => n !== undefined);
    return nums.map((n) => `C${n}`).join(", ") || "—";
  };

  const showForm = showAdd || editId !== null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl">Operatori</h1>
          <p className="text-ink-grey text-sm mt-1">
            Staff del campo: operatori, tecnici, chef e coordinatori assegnati ai turni.
          </p>
        </div>
        {!showForm && (
          <button onClick={startAdd} className="btn btn-green">
            <UserPlus size={18} /> Aggiungi operatore
          </button>
        )}
      </div>

      {showForm && (
        <div className="card mb-6">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl">{editId ? "Modifica operatore" : "Nuovo operatore"}</h2>
              <button onClick={cancel} className="text-ink-grey hover:text-ink">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submit} className="grid sm:grid-cols-2 gap-x-4">
              <div className="field">
                <label>Nome *</label>
                <input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
              </div>
              <div className="field">
                <label>Cognome</label>
                <input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
              </div>
              <div className="field">
                <label>Sesso</label>
                <select value={form.sex} onChange={(e) => set("sex", e.target.value)}>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
              </div>
              <div className="field">
                <label>Ruolo</label>
                <select value={form.role} onChange={(e) => set("role", e.target.value)}>
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div className="field">
                <label>Telefono</label>
                <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div className="field sm:col-span-2">
                <label>Note</label>
                <input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="es. Cucina, AR 01/07, etc." />
              </div>
              <div className="field sm:col-span-2">
                <label>Turni assegnati</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {turni.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTurno(t.id)}
                      className={`tag ${form.assigned.includes(t.id) ? "tag-green" : "tag-grey"}`}
                    >
                      {t.number}
                    </button>
                  ))}
                </div>
              </div>
              {err && <p className="field-error sm:col-span-2">{err}</p>}
              <div className="sm:col-span-2 flex gap-2 mt-2">
                <button type="submit" disabled={busy} className="btn btn-green">
                  {busy ? "…" : editId ? "Salva modifiche" : "Crea"}
                </button>
                <button type="button" onClick={cancel} className="btn btn-outline">
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-grey-light text-left">
              <th className="p-3 uppercase tracking-cta text-ink-grey">Nome</th>
              <th className="p-3 uppercase tracking-cta text-ink-grey">Ruolo</th>
              <th className="p-3 uppercase tracking-cta text-ink-grey">Sesso</th>
              <th className="p-3 uppercase tracking-cta text-ink-grey">Contatto</th>
              <th className="p-3 uppercase tracking-cta text-ink-grey">Turni</th>
              <th className="p-3 uppercase tracking-cta text-ink-grey">Note</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {operatori.map((op) => (
              <tr key={op.id} className={`border-b border-ink-grey-light/60 hover:bg-sand ${editId === op.id ? "bg-wwf-green-pale/30" : ""}`}>
                <td className="p-3 font-bold">{op.firstName} {op.lastName}</td>
                <td className="p-3"><span className={`tag ${ROLE_COLORS[op.role] || "tag-grey"}`}>{ROLE_LABELS[op.role] || op.role}</span></td>
                <td className="p-3">{op.sex || "—"}</td>
                <td className="p-3 text-xs">
                  {op.email && <div><a href={`mailto:${op.email}`} className="text-wwf-green hover:underline">{op.email}</a></div>}
                  {op.phone && <div><a href={`tel:${op.phone}`} className="hover:underline">{op.phone}</a></div>}
                  {!op.email && !op.phone && "—"}
                </td>
                <td className="p-3 text-xs">{turnNumbers(op)}</td>
                <td className="p-3 text-xs text-ink-grey">{op.notes || "—"}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(op)} className="text-ink hover:text-wwf-green p-2" aria-label="Modifica">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => del(op.id)} className="text-wwf-red hover:bg-wwf-red/10 p-2" aria-label="Elimina">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}