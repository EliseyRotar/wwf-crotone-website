"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { Check, Download } from "lucide-react";

const PACKING_ITEMS_IT = [
  { cat: "Essenziali", items: ["Sacchetto a pelo o lenzuola", "Asciugamani (2-3)", "Costume da bagno", "Scarpe comode da trekking", "Sandali/ciabatte", "Cappello o bandana", "Crema solare SPF 50+", "Borraccia 1L+", "Torcia frontale (per turni notturni)", "Repellente zanzare"] },
  { cat: "Abbigliamento", items: ["T-shirt tecniche (5-6)", "Pantaloni corti", "Pantaloni lunghi leggeri", "Felpa o maglione leggero (per la sera)", "Giacca antivento", "Intimo (7 set)", "Calzini (7 paia)", "Vestito da sera (opzionale per eventi)"] },
  { cat: "Igiene", items: ["Spazzolino e dentifrico", "Bagnoschiuma e shampoo", "Deodorante", "Spazzola/brush", "Fazzoletti", "Mascherina (per polvere)", "Borsa da toilette"] },
  { cat: "Documenti", items: ["Carta d'identità o passaporto", "Tessera sanitaria", "Ricevuta bonifico (se già pagato)", "Eventuali prescrizioni mediche", "Certificato medico (se richiesto)"] },
  { cat: "Opzionale ma utile", items: ["Macchina fotografica subacquea", "Binocolo (per avvistamenti)", "Tappi per le orecchie", "Benda per gli occhi (sonno diurno)", "Power bank", "Adattatore di corrente", "Snack preferiti", "Musica/libri"] }
];

const PACKING_ITEMS_EN = [
  { cat: "Essentials", items: ["Sleeping bag or sheets", "Towels (2-3)", "Swimsuit", "Comfortable hiking shoes", "Sandals / flip-flops", "Hat or bandana", "Sunscreen SPF 50+", "Water bottle 1L+", "Headlamp (for night shifts)", "Mosquito repellent"] },
  { cat: "Clothing", items: ["Technical t-shirts (5-6)", "Shorts", "Light long pants", "Light sweater or hoodie (for evenings)", "Windbreaker jacket", "Underwear (7 sets)", "Socks (7 pairs)", "Evening outfit (optional for events)"] },
  { cat: "Hygiene", items: ["Toothbrush and toothpaste", "Body wash and shampoo", "Deodorant", "Hairbrush/comb", "Tissues", "Dust mask", "Toiletry bag"] },
  { cat: "Documents", items: ["ID card or passport", "Health insurance card", "Bank transfer receipt (if paid)", "Medical prescriptions if any", "Medical certificate (if required)"] },
  { cat: "Optional but useful", items: ["Underwater camera", "Binoculars (for sightings)", "Earplugs", "Sleep mask (daytime sleep)", "Power bank", "Power adapter", "Favorite snacks", "Music/books"] }
];

export default function PackingListClient() {
  const loc = useLocale();
  const data = loc === "it" ? PACKING_ITEMS_IT : PACKING_ITEMS_EN;
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const stored = localStorage.getItem("packing-list");
    if (stored) setChecked(JSON.parse(stored));
  }, []);

  const toggle = (item: string) => {
    setChecked((c) => {
      const next = { ...c, [item]: !c[item] };
      localStorage.setItem("packing-list", JSON.stringify(next));
      return next;
    });
  };

  const reset = () => {
    setChecked({});
    localStorage.removeItem("packing-list");
  };

  const totalItems = data.reduce((acc, cat) => acc + cat.items.length, 0);
  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="container section max-w-3xl">
      <h1 className="text-4xl md:text-5xl mb-3">{loc === "it" ? "Cosa portare" : "Packing list"}</h1>
      <p className="text-ink-2 mb-4">
        {loc === "it" ? "Spunta quello che hai già preparato. La lista si salva sul tuo dispositivo." : "Check off what you've packed. The list is saved on your device."}
      </p>
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-1 h-2 bg-ink-grey-light rounded-full overflow-hidden">
          <div className="h-full bg-wwf-green transition-all" style={{ width: `${(checkedCount / totalItems) * 100}%` }} />
        </div>
        <span className="text-sm font-bold text-ink-2">{checkedCount}/{totalItems}</span>
        <button onClick={reset} className="text-xs text-ink-grey hover:text-wwf-red">
          {loc === "it" ? "Reset" : "Reset"}
        </button>
      </div>

      <div className="space-y-6">
        {data.map((cat) => (
          <div key={cat.cat}>
            <h2 className="text-lg mb-3 text-wwf-green" style={{ borderBottom: "2px solid #007932", paddingBottom: "4px" }}>{cat.cat}</h2>
            <ul className="space-y-1">
              {cat.items.map((item) => (
                <li key={item}>
                  <button
                    onClick={() => toggle(item)}
                    className="flex items-center gap-3 w-full text-left py-2 px-3 rounded hover:bg-sand transition-colors"
                  >
                    <span className={`inline-flex items-center justify-center w-5 h-5 border-2 rounded shrink-0 ${checked[item] ? "bg-wwf-green border-wwf-green" : "border-ink-grey-light"}`}>
                      {checked[item] && <Check size={14} className="text-white" />}
                    </span>
                    <span className={`text-sm ${checked[item] ? "text-ink-grey line-through" : "text-ink-2"}`}>{item}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}