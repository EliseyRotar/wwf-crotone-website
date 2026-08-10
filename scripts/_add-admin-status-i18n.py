"""Add Admin.status.{nav,page,incidents,services} blocks to it.json + en.json so
the admin status page can use the same i18n machinery as the rest of the
admin. Follows the existing pattern (nested object per section)."""
import json
from pathlib import Path

NAVS = {"status": "Stato"}  # shared by both languages

IT = {
    "nav": {"status": "Stato"},
    "page": {
        "title": "Stato del servizio",
        "subtitle": "Gestisci i 24 servizi monitorati e gli incidenti in corso.",
        "tabServices": "Servizi",
        "tabIncidents": "Incidenti",
        "tabHistory": "Storico",
    },
    "services": {
        "table": {
            "name": "Nome",
            "category": "Categoria",
            "source": "Fonte",
            "sourceId": "ID fonte",
            "url": "URL",
            "status": "Stato",
            "uptime": "Uptime 7g",
            "uptime30d": "Uptime 30g",
            "active": "Attivo",
            "actions": "Azioni",
        },
        "new": "Nuovo servizio",
        "edit": "Modifica",
        "deactivate": "Disattiva",
        "reactivate": "Riattiva",
        "noServices": "Nessun servizio configurato. Esegui `npm run db:seed-status`.",
        "save": "Salva",
        "cancel": "Annulla",
        "confirmDeactivate": "Disattivare questo servizio? Smette di apparire sulla pagina pubblica ma i dati storici restano.",
        "confirmReactivate": "Riattivare questo servizio?",
    },
    "incidents": {
        "new": "Nuovo incidente",
        "active": "Incidenti attivi",
        "recent": "Risolti di recente",
        "noActive": "Nessun incidente attivo.",
        "noRecent": "Nessun incidente risolto di recente.",
        "fields": {
            "service": "Servizio",
            "severity": "Gravità",
            "status": "Stato",
            "title_it": "Titolo (IT)",
            "title_en": "Titolo (EN)",
            "body_it": "Descrizione (IT)",
            "body_en": "Descrizione (EN)",
            "started_at": "Inizio",
            "resolved_at": "Risolto il",
        },
        "updates": {
            "title": "Cronologia aggiornamenti",
            "new": "Aggiungi aggiornamento",
            "message_it": "Messaggio (IT)",
            "message_en": "Messaggio (EN)",
            "status": "Stato",
            "submit": "Pubblica",
        },
        "resolve": "Risolvi",
        "reopen": "Riapri",
        "delete": "Elimina",
        "confirmResolve": "Segnare questo incidente come risolto?",
        "confirmDelete": "Eliminare questo incidente? Operazione irreversibile.",
    },
    "sources": {
        "uptimerobot": "UptimeRobot",
        "statuspage": "Statuspage",
        "self-probe": "Self-probe",
        "instatus": "Instatus",
        "manual": "Manuale",
    },
    "categories": {
        "user-facing": "Visibili all'utente",
        "infrastructure": "Infrastruttura",
        "external": "Servizi esterni",
    },
}

EN = {
    "nav": {"status": "Status"},
    "page": {
        "title": "Service status",
        "subtitle": "Manage the 24 monitored services and on-going incidents.",
        "tabServices": "Services",
        "tabIncidents": "Incidents",
        "tabHistory": "History",
    },
    "services": {
        "table": {
            "name": "Name",
            "category": "Category",
            "source": "Source",
            "sourceId": "Source ID",
            "url": "URL",
            "status": "Status",
            "uptime": "7d uptime",
            "uptime30d": "30d uptime",
            "active": "Active",
            "actions": "Actions",
        },
        "new": "New service",
        "edit": "Edit",
        "deactivate": "Deactivate",
        "reactivate": "Reactivate",
        "noServices": "No services configured. Run `npm run db:seed-status`.",
        "save": "Save",
        "cancel": "Cancel",
        "confirmDeactivate": "Deactivate this service? It will stop appearing on the public page but historical data is preserved.",
        "confirmReactivate": "Reactivate this service?",
    },
    "incidents": {
        "new": "New incident",
        "active": "Active incidents",
        "recent": "Recently resolved",
        "noActive": "No active incidents.",
        "noRecent": "No recently resolved incidents.",
        "fields": {
            "service": "Service",
            "severity": "Severity",
            "status": "Status",
            "title_it": "Title (IT)",
            "title_en": "Title (EN)",
            "body_it": "Description (IT)",
            "body_en": "Description (EN)",
            "started_at": "Started",
            "resolved_at": "Resolved at",
        },
        "updates": {
            "title": "Update timeline",
            "new": "Add update",
            "message_it": "Message (IT)",
            "message_en": "Message (EN)",
            "status": "Status",
            "submit": "Publish",
        },
        "resolve": "Resolve",
        "reopen": "Reopen",
        "delete": "Delete",
        "confirmResolve": "Mark this incident as resolved?",
        "confirmDelete": "Delete this incident? This cannot be undone.",
    },
    "sources": {
        "uptimerobot": "UptimeRobot",
        "statuspage": "Statuspage",
        "self-probe": "Self-probe",
        "instatus": "Instatus",
        "manual": "Manual",
    },
    "categories": {
        "user-facing": "User-facing",
        "infrastructure": "Infrastructure",
        "external": "External services",
    },
}

for lang, block in (("it", IT), ("en", EN)):
    path = Path(f"src/i18n/messages/{lang}.json")
    with path.open() as f: d = json.load(f)
    if "status" not in d["Admin"]:
        d["Admin"]["status"] = block
    else:
        # merge — overrides our defaults if existing keys present
        for k, v in block.items():
            if k not in d["Admin"]["status"]:
                d["Admin"]["status"][k] = v
            elif isinstance(v, dict):
                for kk, vv in v.items():
                    if kk not in d["Admin"]["status"][k]:
                        d["Admin"]["status"][k][kk] = vv
    with path.open("w") as f: json.dump(d, f, ensure_ascii=False, indent=2)
    print(f"✓ {lang}: added Admin.status")
