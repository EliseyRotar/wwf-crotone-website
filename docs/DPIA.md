# Valutazione d'Impatto sulla Protezione dei Dati (DPIA)

**Data Protection Impact Assessment (DPIA) — Art. 35 GDPR**

---

## Frontespizio / Cover Page

| Campo | Valore |
|---|---|
| **Titolare del trattamento** | WWF Crotone — Sezione locale di WWF Italia ETS |
| **Sede** | Provincia di Crotone, Calabria — Italia |
| **Contatto del Titolare** | [redacted — see controller contact] |
| **Responsabile della protezione dei dati (DPO)** | *(da designare — cfr. § 6.4)* |
| **Rappresentante del Titolare (art. 27)** | Non applicabile (titolare stabilito nell'UE) |
| **Referente interno per la DPIA** | [redacted — internal] |
| **Data di redazione** | 3 agosto 2026 |
| **Versione** | 1.0 |
| **Stato** | Definitivo, in attesa di designazione DPO |
| **Trattamenti oggetto della valutazione** | Iscrizione ai campi di volontariato estivi; area personale del volontario; chatbot pubblico; newsletter; caricamento ricevute di pagamento |
| **Base giuridica della DPIA** | Art. 35 GDPR; raccomandazione WP248 (WP29) e linee-guida EDPB; Provvedimento Garante per la protezione dei dati personali del 15 aprile 2018, n. 274 (criteri di individuazione dei trattamenti soggetti a DPIA) |
| **Lingue** | Italiano (testo prevalente per il Garante) e inglese (per stakeholder internazionali) |

> **Avvertenza.** Il presente documento è redatto in conformità all'art. 35 GDPR e alle linee-guida del Gruppo di lavoro ex art. 29 (WP248rev.01) adottate dal Comitato europeo per la protezione dei dati (EDPB). La versione italiana fa fede; la versione inglese è fornita a beneficio dei volontari e degli stakeholder internazionali.

---

# PARTE I — VERSIONE ITALIANA

---

## 1. Descrizione del trattamento

### 1.1. Natura del trattamento

Il sito web ufficiale della sezione WWF Crotone (di seguito, "**il Sito**") costituisce il punto di contatto digitale per l'organizzazione e la gestione dei campi estivi di volontariato ambientale che la Sezione locale di WWF Italia ETS tiene annualmente presso il C.E.L.A. — Centro di Educazione alla Legalità e all'Ambiente di San Leonardo di Cutro (KR). Il Sito raccoglie e tratta dati personali di volontari maggiorenni e minorenni (di età compresa tra i 12 e i 17 anni) che intendono partecipare alle attività di campo, nonché dei loro esercenti la responsabilità genitoriale.

Le operazioni di trattamento si sostanziano in: raccolta, registrazione, organizzazione, conservazione, consultazione, elaborazione, comunicazione e cancellazione dei dati personali degli interessati, in forma sia automatizzata (attraverso l'applicazione Next.js 15 in esercizio) sia, in misura residuale, manuale (posta elettronica dei referenti, inoltro di ricevute di pagamento, corrispondenza con gli operatori del campo).

### 1.2. Contesto del trattamento

Il trattamento è effettuato dalla Sezione locale di WWF Crotone — organizzazione senza scopo di lucro di ridotte dimensioni, priva di personale dipendente retribuito e operante su base volontaria — nell'ambito della propria missione statutaria di tutela dell'ambiente e di educazione ambientale. La base associativa di riferimento è costituita dalla compagine di WWF Italia ETS, della quale WWF Crotone è Sezione locale ai sensi dell'art. 36 del Codice civile. L'infrastruttura tecnica è ospitata su cloud provider conformi al GDPR; il codice applicativo è open-source (repository interno del Titolare).

### 1.3. Finalità del trattamento

I dati personali sono trattati per le seguenti finalità:

1. **Gestione delle iscrizioni** ai dodici turni settimanali del campo estivo (periodo 21 giugno — 13 settembre 2026): raccolta delle adesioni, verifica dei requisiti di età, gestione delle liste di attesa, controllo della capienza dei turni e della non duplicazione delle iscrizioni. Base giuridica: art. 6, par. 1, lett. b) GDPR — esecuzione di un contratto di cui l'interessato è parte o di misure precontrattuali adottate su richiesta dello stesso.
2. **Tutela della salute e dell'incolumità** dei partecipanti durante le attività di campo (comprese le escursioni naturalistiche, le attività di pulizia delle spiagge, il monitoraggio dei nidi di Caretta caretta): conoscenza di allergie, intolleranze, terapie farmacologiche in corso, condizioni fisiche auto-riportate, capacità natatoria, stato vaccinale antitetanico. Base giuridica: art. 9, par. 2, lett. a) GDPR — consenso esplicito dell'interessato, ovvero art. 9, par. 2, lett. h) in combinato disposto con l'art. 2-sexies, comma 2, lett. t) del d.lgs. 196/2003 (Codice privacy, come novellato dal d.lgs. 101/2018) — finalità di medicina preventiva, valutazione dell'idoneità fisica a partecipare ad attività di volontariato ambientale.
3. **Adempimento degli obblighi di legge** in materia di sicurezza, assicurazione dei volontari e tutela dei minori. Base giuridica: art. 6, par. 1, lett. c) GDPR.
4. **Gestione dei pagamenti** della quota di partecipazione e dell'eventuale saldo, con tracciamento delle ricevute di bonifico bancario. Base giuridica: art. 6, par. 1, lett. b) GDPR.
5. **Comunicazioni informative e newsletter** ai volontari che abbiano prestato consenso specifico. Base giuridica: art. 6, par. 1, lett. a) GDPR — consenso.
6. **Sicurezza informatica e prevenzione delle frodi**: tracciamento degli accessi, rate limiting, rilevamento di abusi e attacchi (incluso prompt injection sul chatbot). Base giuridica: art. 6, par. 1, lett. f) GDPR — legittimo interesse del Titolare alla sicurezza dei propri sistemi.
7. **Profilazione e analisi statistiche aggregate anonime** sui flussi di iscrizione, sulla provenienza geografica e sulla composizione demografica. Base giuridica: art. 6, par. 1, lett. f) GDPR, subordinatamente a una valutazione di legittimo interesse ex art. 47 GDPR e in assenza di effetti significativi sugli interessati (cfr. WP248rev.01, § IV.3).

### 1.4. Categorie di dati personali trattati

La tabella che segue elenca le categorie di dati trattati, con indicazione del trattamento di riferimento, della base giuridica e dell'eventuale qualifica come "categoria particolare" ex art. 9 GDPR.

| Categoria | Trattamento | Tipo | Base giuridica | Categoria particolare (art. 9) |
|---|---|---|---|---|
| Nome e cognome | Iscrizione, area personale, newsletter | Identificativo | Art. 6(1)(b) | No |
| Data di nascita / età | Iscrizione | Identificativo | Art. 6(1)(b) e art. 8 GDPR (minori) | No (ma rilevante per la verifica della minore età) |
| Indirizzo email | Iscrizione, magic-link, newsletter | Identificativo/contatto | Art. 6(1)(b)/(a) | No |
| Numero di telefono | Iscrizione | Contatto | Art. 6(1)(b) | No |
| Nome, email e telefono dell'esercente la responsabilità genitoriale | Iscrizione minorenni | Identificativo | Art. 6(1)(b) e art. 8 GDPR | No |
| **Allergie e intolleranze alimentari** | Iscrizione | Salute | Art. 9(2)(a) consenso esplicito | **Sì** |
| **Terapie farmacologiche in corso** | Iscrizione | Salute | Art. 9(2)(a) consenso esplicito | **Sì** |
| **Capacità natatoria** | Iscrizione | Salute/idoneità fisica | Art. 9(2)(h) + art. 2-sexies(2)(t) d.lgs. 196/2003 | **Sì** |
| **Stato vaccinale antitetanico** | Iscrizione | Salute | Art. 9(2)(h) | **Sì** |
| **Condizioni fisiche auto-riportate** ("fitness self-assessment") | Iscrizione | Salute | Art. 9(2)(a) consenso esplicito | **Sì** |
| Esigenze alimentari (vegetariano, vegano, celiaco) | Iscrizione | Abitudini | Art. 6(1)(b) | No (non rivelano convinzioni) |
| Taglia della maglietta | Iscrizione | Logistica | Art. 6(1)(b) | No |
| Modalità e orari di arrivo/partenza | Iscrizione | Logistica | Art. 6(1)(b) | No |
| Ricevute di bonifico bancario (PDF/JPEG/PNG) | Area personale | Contabili/amministrativi | Art. 6(1)(b) e (c) | No (ma contengono IBAN e importi) |
| Indirizzo IP, user-agent | Magic-link, rate-limit, audit | Tecnico | Art. 6(1)(f) | No |
| Cookie tecnici e di sessione | Navigazione | Tecnico | Art. 6(1)(f) (eccezione dei cookie strettamente necessari, considerando il Provv. Garante 10 giugno 2021) | No |
| **Immagini fotografiche** (solo previo consenso specifico) | Galleria | Biometrico/identificativo | Art. 9(2)(a) consenso esplicito | **Sì** se pubblicate con volti riconoscibili |

> **Nota.** Le categorie di dati che il sistema marca come "salute" (campo `allergies`, `medications`, `swimmingAbility`, `tetanusStatus`, `fitnessSelf` nel modello `Iscrizione`, definito in `prisma/schema.prisma` righe 68-73) costituiscono dati sanitari o idonei a rivelare lo stato di salute ai sensi dell'art. 4, n. 15 GDPR.

### 1.5. Categorie di interessati

| Categoria | Fascia d'età | Provenienza | Volume stimato (stagione 2026) |
|---|---|---|---|
| Volontari maggiorenni | 18+ | Italia + UE + extra-UE | ~ 200 |
| Volontari minorenni | 12-17 | Italia + UE + extra-UE | ~ 40 |
| Esercenti la responsabilità genitoriale | Maggiorenni | Genitori dei minori iscritti | ~ 60-80 |
| Iscritti alla newsletter | Maggiorenni e minorenni con consenso del genitore | Pubblico del Sito | ~ 500 |
| Operatori del campo (coordinatori, tecnici) | Maggiorenni | Personale volontario interno | ~ 30 |
| Amministratori del Sito (superadmin, manager) | Maggiorenni | Personale interno autorizzato | 2-5 |

### 1.6. Flussi di dati

Il diagramma che segue descrive i flussi di dati tra i diversi attori del trattamento, con indicazione dei Paesi terzi di destinazione e delle garanzie applicabili.

```
[Volontario]                                                        
  │                                                                 
  │ HTTPS / TLS 1.3 (CSP con nonce — cfr. src/middleware.ts)       
  ▼                                                                 
[Sito WWF Crotone — Next.js 15 + Prisma]                           
  │                                                                 
  ├──► Cloudflare (CDN, edge cache)         [Paese: UE/USA, SCC]    
  │                                                                 
  ├──► Brevo (SMTP transazionale, newsletter) [Paese: UE/FRA, GDPR] 
  │       • indirizzo email del volontario                         
  │       • IBAN (solo nei template di conferma)                    
  │                                                                 
  ├──► Groq Inc. (chatbot LLM)              [Paese: USA, SCC + DPA]
  │       • messaggi dell'utente (testo libero)                     
  │       • nessun dato identificativo inserito dal sistema         
  │                                                                 
  ├──► Sentry (error monitoring)            [Paese: USA, SCC + DPA]
  │       • SOLO per route NON-sensibili                            
  │       • Filtro `beforeSend` su PII (cfr. sentry.server.config.ts)
  │                                                                 
  ├──► Google Fonts (asset statici)         [Paese: USA, SCC]       
  │                                                                 
  ├──► Plausible Analytics (auto-hosted)    [Paese: UE]             
  │       • solo analytics aggregati                                
  │                                                                 
  └──► Database SQLite (dev) / PostgreSQL (prod)                    
        • dati personali, sanitari, anagrafici                      
        • backup cifrati (proposta — cfr. § 4.2)                    
```

> **Trasferimenti verso Paesi terzi.** I flussi verso Groq Inc. (provider del chatbot) e verso Sentry Inc. (error monitoring) comportano un trasferimento di dati verso gli Stati Uniti d'America. Tali trasferimenti sono fondati sulle Clausole Contrattuali Standard della Commissione europea (SCC, decisione di esecuzione (UE) 2021/914) integrate da una valutazione d'impatto del trasferimento (TIA) ex art. 46 GDPR e, dal 10 luglio 2023, sul Data Privacy Framework UE-USA (Decisione di esecuzione (UE) 2023/1795). Per Sentry, la documentazione di supporto è verificabile in `sentry.server.config.ts`, dove il filtro `beforeSend` garantisce che nessun dato personale (né body, né cookie, né header, né IP) venga trasmesso per le route sensibili (`/api/chat/`, `/api/admin/`, `/api/iscrizione`).

### 1.7. Periodi di conservazione

| Categoria di dato | Periodo di conservazione | Base giuridica della conservazione |
|---|---|---|
| Dati anagrafici e di contatto dei volontari iscritti | 10 anni dalla fine del campo (conservazione ai fini fiscali e di rendicontazione verso WWF Italia ETS) | Art. 6(1)(c) GDPR — adempimento obbligo di legge; art. 2220 c.c. |
| Dati sanitari (allergie, farmaci, capacità natatoria, stato vaccinale) | 1 anno dalla fine del campo (necessari esclusivamente per la tutela incolumità durante il campo) | Art. 5(1)(e) GDPR — limitazione della conservazione; il dato non è più necessario per le finalità |
| Dati dei minorenni (anagrafica, contatto del genitore, consensi) | Come sopra; cancellazione anticipata su richiesta del genitore | Art. 17 GDPR — diritto alla cancellazione |
| Ricevute di pagamento (PDF/JPEG/PNG) | 10 anni (conservazione contabile) | Art. 6(1)(c) GDPR; art. 2220 c.c. |
| Magic-link (hash SHA-256 + email + IP + UA) | 30 minuti (scadenza tecnica) + cancellazione lazy in `prisma.magicLink.deleteMany` (`src/lib/magicLink.ts` riga 100) | Necessità tecnica — non sono dati conservati "per finalità" |
| Token di sessione account (httpOnly cookie, 24h) | 24 ore | Necessità tecnica |
| Cookie "ricorda dispositivo" (30 giorni) | 30 giorni | Necessità tecnica |
| Audit log (`AuditLog`) | 24 mesi (proposta — cfr. § 4.2) | Art. 6(1)(f) GDPR — legittimo interesse alla sicurezza e alla ricostruzione della cronologia delle modifiche |
| Newsletter (email, consenso, IP del consenso) | Fino a revoca del consenso + 30 giorni per smaltimento tecnico | Art. 6(1)(a) GDPR; art. 7(3) — revoca del consenso |
| IP, UA di richieste respinte / rate-limit | 0 (cancellati alla scadenza del bucket) | Art. 6(1)(f) GDPR — legittimo interesse |
| Log di errori Sentry | 90 giorni (default Sentry) | Art. 6(1)(f) GDPR — sicurezza |
| Backup del database | 30 giorni (proposta) | Art. 6(1)(c) e (f) GDPR |

> **Misure tecniche di cancellazione.** I magic-link sono cancellati in modo massivo (lazy GC) ad ogni nuova generazione, come documentato in `src/lib/magicLink.ts:100-106`. La cancellazione delle Iscrizioni e relativi allegati è effettuata esclusivamente dall'amministratore (cfr. `src/app/api/admin/iscrizioni/route.ts:117-158` — DELETE riservato a `superadmin`); la procedura di richiesta da parte dell'interessato è documentata in `src/app/api/account/gdpr-delete/route.ts` e produce una notifica via email all'amministratore del Sito.

---

## 2. Valutazione della necessità e della proporzionalità

### 2.1. Basi giuridiche, finalità per finalità

| Finalità | Base giuridica (art. 6 GDPR) | Categoria particolare (art. 9 GDPR) | Consenso richiesto |
|---|---|---|---|
| Gestione dell'iscrizione (anagrafica, recapiti, turno) | Art. 6(1)(b) — esecuzione di misure precontrattuali | — | Privacy consent (art. 7) — necessario per procedere |
| Trattamento dati sanitari (allergie, farmaci, capacità natatoria, stato vaccinale) | — | Art. 9(2)(a) consenso esplicito (per allergie, farmaci, fitness) + art. 9(2)(h) in combinato con art. 2-sexies(2)(t) d.lgs. 196/2003 (idoneità fisica) | Sì, consenso esplicito separato (richiesto il flag) |
| Trattamento dati di minori | Art. 6(1)(b) + art. 8 GDPR | Come sopra, quando ricorre | Sì, consenso del genitore (verifica documentale) |
| Pagamento e tracciamento ricevute | Art. 6(1)(b) | — | Privacy consent |
| Newsletter | Art. 6(1)(a) — consenso | — | Sì, opt-in specifico |
| Immagini fotografiche (galleria) | Art. 6(1)(a) | Art. 9(2)(a) per immagini identificative | Sì, consenso specifico per immagine |
| Sicurezza informatica | Art. 6(1)(f) — legittimo interesse | — | Informativa |
| Adempimenti contabili e fiscali | Art. 6(1)(c) | — | Informativa |

### 2.2. Meccanismi di consenso

I consensi sono raccolti secondo i principi di cui all'art. 7 GDPR e alle linee-guida EDPB sul consenso (Guidelines 05/2020):

- **Libertà del consenso**: l'iscrizione al campo non è condizionata al consenso per la newsletter o per le immagini (consensi separati, opt-in). Il consenso al trattamento dei dati sanitari è separato dal consenso al trattamento dei dati anagrafici.
- **Specificità**: vengono raccolti consensi distinti per (i) privacy policy, (ii) marketing/newsletter, (iii) immagini/foto, (iv) per ciascuna finalità di trattamento dei dati sanitari.
- **Informed**: prima del flag di consenso, l'interessato visualizza un link all'informativa privacy estesa (`/it/privacy`).
- **Unambiguous**: il flag deve essere esplicitamente impostato a `true`. Lo schema Zod in `src/app/api/iscrizione/route.ts:39` impone `z.boolean().refine((v) => v === true)`. Per i minorenni, lo schema impone inoltre la presenza di `guardianName`, `guardianPhone` e `guardianConsent: true` (cfr. `src/app/api/iscrizione/route.ts:80-82`).
- **Revocabilità**: il consenso può essere revocato in qualsiasi momento via email al Titolare o tramite il form di recesso dell'area personale (`/account` → "richiedi cancellazione"), che produce una notifica scritta all'amministratore e una riga in `AuditLog` (`gdpr_delete_request`).
- **Dimostrabile**: l'API di iscrizione alla newsletter (`src/app/api/newsletter/route.ts:30-37`) memorizza per ogni consenso la data, l'IP e lo user-agent.

### 2.3. Verifica della minore età e consenso genitoriale

Il sistema implementa la verifica server-side della minore età calcolata in base alla data di nascita rispetto alla data di inizio del campo (cfr. `src/app/api/iscrizione/route.ts:74-79` e funzione `isUnder18` in `src/lib/turns.ts`). In caso di discrepanza tra il flag `isMinor` dichiarato dal client e l'età calcolata server-side, la richiesta viene rifiutata (`error: "minor-mismatch"`). La verifica dell'identità del genitore è dichiarativa (campo libero): non viene richiesto un documento d'identità. Si raccomanda l'introduzione di una procedura di verifica documentale a campione (cfr. § 6.2 — raccomandazione R-04).

### 2.4. Minimizzazione dei dati

Il Titolare ha applicato il principio di minimizzazione ex art. 5(1)(c) GDPR come segue:

- I campi facoltativi (allergie, farmaci, fitness self-assessment) sono memorizzati come `null` se non valorizzati; il sistema non richiede la compilazione di alcun campo sanitario per procedere all'iscrizione, ma li richiede per la partecipazione al campo (il dato è *necessario* e non *accessorio*).
- Non vengono raccolti: codice fiscale, indirizzo di residenza, numero di documento, nazionalità (eccetto ove implicita nel turno), professione, dati biometrici.
- Il chatbot è istruito a *non chiedere* dati personali all'utente e a invitarlo a cancellarli spontaneamente in caso di condivisione accidentale (cfr. `src/lib/chatbot-knowledge.ts:24`).

### 2.5. Esattezza

L'interessato ha la facoltà di modificare i propri dati personali e sanitari tramite l'area personale (`/account/bookings/[id]/update`) fino alla data di inizio del turno (cfr. `src/lib/bookingLock.ts:60-87`). I campi anagrafici possono essere modificati solo fino a quando l'amministratore non confermi l'identità del volontario (impostando `personalDataLockedAt`, cfr. `PERSONAL_DATA_FIELDS` in `src/lib/bookingLock.ts:35-53`).

### 2.6. Limitazione della conservazione

Si rinvia alla tabella di § 1.7. Si evidenzia in particolare che:

- I magic-link sono conservati esclusivamente come hash SHA-256 per 30 minuti (`src/lib/magicLink.ts:29`).
- I dati sanitari (allergie, farmaci) sono conservati per un solo anno dalla fine del campo, decorso il quale saranno cancellati o anonimizzati.
- La newsletter conserva l'email fino a revoca del consenso, dopodiché il record viene marcato con `unsubscribedAt` ma non cancellato (per impedire re-iscrizioni indesiderate: cfr. `src/app/api/newsletter/unsubscribe/route.ts:41-45`).

### 2.7. Integrità e riservatezza — misure di sicurezza

Le misure tecniche e organizzative sono dettagliate al § 4. Si anticipa che il sistema implementa: cifratura in transito (TLS 1.3, HSTS preload), Content Security Policy con nonce per richiesta (`src/middleware.ts:85-117`), autenticazione a doppio fattore per gli amministratori (campo `totpEnabled` nel modello `User`, `prisma/schema.prisma:21-22`), hashing bcrypt delle password, firma HMAC dei token di sessione, validazione CSRF su tutte le route non idempotenti (`src/lib/csrf.ts`), rate limiting sia in-memory che Upstash (`src/lib/rateLimit.ts`), magic-link monouso, magic-bytes validation su tutti gli upload (`src/app/api/admin/upload/route.ts:50-65`, `src/app/api/account/booking/[id]/receipt/route.ts:18-41`).

---

## 3. Valutazione dei rischi

### 3.1. Metodologia

L'analisi del rischio è condotta secondo la metodologia WP248rev.01 (linee-guida EDPB) e la norma ISO/IEC 27005:2022. Per ciascun rischio individuato sono valutate:

- **Probabilità** (P): 1 (trascurabile), 2 (bassa), 3 (media), 4 (alta)
- **Impatto** (I): 1 (trascurabile), 2 (contenuto), 3 (significativo), 4 (rilevante)
- **Rischio lordo** (R = P × I): 1-4 trascurabile, 5-8 moderato, 9-12 elevato, 13-16 critico
- **Misure di mitigazione** e rischio residuo

### 3.2. Matrice dei rischi

| ID | Descrizione del rischio | Soggetti impattati | P | I | R lordo |
|---|---|---|---|---|---|
| **R-01** | Accesso non autorizzato al database (SQLi, dump del DB) con conseguente esfiltrazione di dati anagrafici, sanitari, di minori | Tutti gli interessati | 2 | 4 | **8 (Moderato)** |
| **R-02** | Accesso abusivo all'area personale del volontario (ruberia del cookie) | Volontari maggiorenni e minorenni | 2 | 3 | **6 (Moderato)** |
| **R-03** | Accesso abusivo all'area amministrativa (ruberia delle credenziali) | Volontari, integrità del sistema | 2 | 4 | **8 (Moderato)** |
| **R-04** | Captazione del magic-link email (intercettazione SMTP, compromissione mailbox) | Volontari | 1 | 4 | **4 (Trascurabile)** |
| **R-05** | Caricamento di file malevolo (ricevute, foto galleria) — esecuzione di codice lato server | Integrità del sistema | 1 | 4 | **4 (Trascurabile)** |
| **R-06** | Esposizione del dato sanitario (allergie, farmaci) per errata configurazione ACL o bug | Volontari con dati sanitari | 2 | 4 | **8 (Moderato)** |
| **R-07** | Dato di minore trattato senza valido consenso genitoriale (falsa identità del genitore) | Minori | 2 | 4 | **8 (Moderato)** |
| **R-08** | Perdita di dati (disastro, errore umano) senza backup | Tutti gli interessati | 2 | 3 | **6 (Moderato)** |
| **R-09** | Violazione dei dati (data breach) con notifica tardiva al Garante / interessati | Tutti gli interessati, reputazione | 2 | 3 | **6 (Moderato)** |
| **R-10** | Trasferimento di dati verso gli USA (Groq, Sentry) in assenza di garanzie adeguate | Interessati UE | 1 | 3 | **3 (Trascurabile)** |
| **R-11** | Prompt injection sul chatbot con esfiltrazione di dati riservati o generazione di contenuti dannosi | Utenti del chatbot | 2 | 2 | **4 (Trascurabile)** |
| **R-12** | Uso dei dati per finalità ulteriori (profilazione non dichiarata, marketing aggressivo) | Volontari iscritti | 1 | 3 | **3 (Trascurabile)** |
| **R-13** | Conservazione oltre i termini (assenza di procedure automatiche di cancellazione) | Tutti gli interessati | 2 | 2 | **4 (Trascurabile)** |
| **R-14** | Trattamento dati sanitari con base giuridica inadeguata (assenza di consenso esplicito) | Volontari con dati sanitari | 1 | 4 | **4 (Trascurabile)** |
| **R-15** | Identificazione di un minore tramite fotografia pubblicata in galleria | Minori | 1 | 4 | **4 (Trascurabile)** |
| **R-16** | Attacchi di forza bruta al login amministratore | Integrità del sistema | 2 | 4 | **8 (Moderato)** |
| **R-17** | CSRF su endpoint di scrittura (cambio stato, modifica profilo) | Integrità dei dati | 1 | 3 | **3 (Trascurabile)** |
| **R-18** | Denial of service del chatbot (esaurimento quota Groq) | Disponibilità del servizio | 2 | 2 | **4 (Trascurabile)** |
| **R-19** | Furto di IBAN dall'output del chatbot (rivelazione accidentale) | Utenti | 1 | 2 | **2 (Trascurabile)** |
| **R-20** | Accesso al Sito da parte di minori di 12 anni (sotto la soglia di partecipazione) | Minori sotto i 12 | 2 | 2 | **4 (Trascurabile)** |

### 3.3. Discussione dei rischi principali

**R-06 — Esposizione del dato sanitario.** Il modello `Iscrizione` (cfr. `prisma/schema.prisma:68-73`) memorizza i dati sanitari (allergie, farmaci, capacità natatoria, stato vaccinale, fitness self-assessment) in colonne testuali non cifrate. L'accesso a tali colonne è filtrato da due livelli: autenticazione amministratore (`getSession()` in `src/lib/auth.ts:71-91`) e ACL per turno (`canAccessTurn` in `src/lib/auth.ts:132-136`). Per l'area personale del volontario, l'accesso è limitato al solo `iscrizioneId` della sessione (`getAccountSession` in `src/lib/accountSession.ts:196-273`). Un bug di applicazione (es. mancato filtro in una nuova rotta admin) potrebbe esporre i dati. Misure di mitigazione proposte: cifratura a riposo delle colonne sanitarie (cfr. § 4.2, R-06-mit), test automatici di access control su ogni nuova rotta.

**R-07 — Consenso genitoriale non verificato.** Il sistema si basa su autodichiarazione del genitore (campo `guardianName`, `guardianEmail`, `guardianPhone` e flag `guardianConsent`). Non viene richiesto un documento d'identità del genitore. Un minore potrebbe iscriversi dichiarando un genitore fittizio. Misure di mitigazione proposte: verifica a campione del documento di identità del genitore per i minori di età inferiore a 14 anni, in conformità con l'art. 8 GDPR e con l'orientamento del Garante italiano sul consenso dei minori (cfr. § 6.2 — R-04).

**R-10 — Trasferimento verso gli USA (Groq, Sentry).** Il chatbot invia messaggi testuali a Groq Inc. (provider del modello Llama 3.3 70B). Il sistema non inietta dati personali nei messaggi dell'utente, ma l'utente stesso potrebbe condividere spontaneamente dati personali nella conversazione (misura mitigata da: prompt di sistema che scoraggia la condivisione + filtro regex `redactPII` su numeri di telefono e IBAN, cfr. `src/app/api/chat/route.ts:128-134`). Per Sentry, il filtro `beforeSend` in `sentry.server.config.ts:24-49` impedisce la trasmissione di qualsiasi dato personale per le route sensibili.

---

## 4. Misure previste per affrontare i rischi

### 4.1. Misure tecniche già implementate

| ID | Misura | Implementazione | Rischi mitigati |
|---|---|---|---|
| **T-01** | Cifratura in transito (TLS 1.3 + HSTS preload) | `next.config.js:46-48` | R-04, R-05, R-17 |
| **T-02** | Content Security Policy con nonce per richiesta | `src/middleware.ts:47-117` | R-11, R-17 |
| **T-03** | Header di sicurezza (X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy) | `next.config.js:41-44` | R-17 |
| **T-04** | Hashing bcrypt delle password amministratore | `src/lib/auth.ts:121` | R-03, R-16 |
| **T-05** | JWT firmati HS256 con `AUTH_SECRET` validato all'avvio (rifiuto di segreti deboli) | `src/lib/auth.ts:20-38` | R-03 |
| **T-06** | Sessione amministratore con `httpOnly`, `Secure`, `SameSite=Strict`, durata 8h | `src/lib/auth.ts:96-108` | R-02, R-03 |
| **T-07** | Autenticazione a due fattori (TOTP) per amministratori | `User.totpEnabled` in `prisma/schema.prisma:21-22` | R-03, R-16 |
| **T-08** | Cookie "ricorda dispositivo" firmato HMAC e legato al device fingerprint (UA + Accept-Language) | `src/lib/deviceSession.ts:66-156` | R-02 |
| **T-09** | Magic-link monouso, con hash SHA-256 del token (mai memorizzato in chiaro), scadenza 30 min | `src/lib/magicLink.ts:29-152` | R-04 |
| **T-10** | Verifica CSRF su tutte le route non idempotenti (POST, PATCH, DELETE) | `validateOrigin` in `src/lib/csrf.ts` (richiamato in tutte le route API di scrittura) | R-17 |
| **T-11** | Rate limiting in-memory + Upstash con chiave su IP trusted proxy | `src/lib/rateLimit.ts:82-104` | R-16, R-18 |
| **T-12** | Validazione input con Zod su tutte le route API | (es.) `src/app/api/iscrizione/route.ts:15-43` | R-17 |
| **T-13** | Validazione magic-bytes (non solo MIME) sugli upload | `src/app/api/admin/upload/route.ts:50-65`, `src/app/api/account/booking/[id]/receipt/route.ts:18-41` | R-05 |
| **T-14** | Filtro `beforeSend` su Sentry per route sensibili (rimozione body, cookie, IP) | `sentry.server.config.ts:24-49` | R-10 |
| **T-15** | Audit log per-field per ogni modifica di un'Iscrizione | `src/lib/audit.ts:59-81`, `logFieldChange` in `src/app/api/account/booking/[id]/update/route.ts:199-216` | R-09 |
| **T-16** | Protezione da prompt injection su chatbot (regex + Groq Prompt Guard + topic guard) | `src/lib/chatGuard.ts`, `src/app/api/chat/route.ts:58-85, 132-134` | R-11, R-19 |
| **T-17** | Filtro PII sull'output del chatbot (regex su telefoni e IBAN) | `src/app/api/chat/route.ts:128-134` | R-19 |
| **T-18** | Lista strumenti limitata a `check_availability` (read-only) per il chatbot | `src/app/api/chat/route.ts:151-227` | R-11 |
| **T-19** | Soft-delete (`deletedAt`) su Iscrizioni, Operatori, Gallery, Blog per consentire cancellazione logica e audit | `prisma/schema.prisma:103, 150, 183, 249` | R-13 |
| **T-20** | Meccanismo di recesso (gdpr-delete) che produce notifica email + riga di audit | `src/app/api/account/gdpr-delete/route.ts:37-117` | R-12, R-13 |

### 4.2. Misure tecniche e organizzative da implementare

| ID | Misura | Tempistica | Rischi mitigati |
|---|---|---|---|
| **T-21** | **Cifratura a riposo delle colonne sanitarie** (`allergies`, `medications`, `swimmingAbility`, `tetanusStatus`, `fitnessSelf`, `dietaryNotes`) tramite envelope encryption con chiave gestita in HSM/KMS. In alternativa: cifratura a livello di applicazione con chiave separata per colonna. | 3 mesi | R-01, R-06 |
| **T-22** | **Cifratura dei backup** del database (chiave separata) e archiviazione off-site (es. AWS S3 con SSE-KMS in regione UE) | 3 mesi | R-08 |
| **T-23** | **Verifica documentale del consenso genitoriale** per minori di età < 14 anni: richiesta via email del documento d'identità del genitore al momento della conferma dell'iscrizione da parte dell'amministratore | 6 mesi | R-07 |
| **T-24** | **Procedura di cancellazione automatica** dei dati sanitari decorsi 12 mesi dalla fine del campo (cron job) | 3 mesi | R-13 |
| **T-25** | **Procedura di cancellazione automatica** delle Iscrizioni decorsi 10 anni dalla fine del campo, salvo opposizione esplicita dell'interessato per conservazione | 3 mesi | R-13 |
| **T-26** | **Test di access control automatici** su ogni rotta API che accede a dati personali (CI/CD) | 2 mesi | R-01, R-06 |
| **T-27** | **Penetration test annuale** del Sito (incluse le API e il pannello admin) da parte di un terzo indipendente | Annuale | R-01, R-02, R-03 |
| **T-28** | **DPIA refresh annuale** o in caso di modifiche sostanziali (nuovi trattamenti, nuovi fornitori, modifiche al set di dati) | Annuale | Tutti |
| **T-29** | **Formazione del personale** (compagine volontaria) in materia di protezione dei dati personali, con particolare riferimento al trattamento di dati sanitari e di minori | Annuale | R-07, R-12, R-14 |
| **T-30** | **Registro dei trattamenti** aggiornato ex art. 30 GDPR, tenuto in forma elettronica (già parzialmente implementato in `prisma/schema.prisma`) | 1 mese | R-01 |
| **T-31** | **Notifica di violazione al Garante entro 72h** (art. 33 GDPR): procedura documentata, responsabilità definite (chi scopre → chi notifica → chi gestisce) | 1 mese | R-09 |
| **T-32** | **Designazione del DPO** (cfr. § 6.4): valutazione dei criteri di obbligatorietà ex art. 37(1) GDPR — il trattamento sistematico di dati sanitari e di minori su larga scala **rende obbligatoria la designazione** | Immediata | R-09, R-14 |
| **T-33** | **Valutazione d'impatto del trasferimento (TIA)** per Groq Inc. e Sentry Inc., con identificazione delle misure supplementari (cifratura end-to-end, pseudonimizzazione) | 6 mesi | R-10 |
| **T-34** | **Clausole specifiche sul trattamento di immagini di minori** nella galleria: richiesta di consenso specifico e revisione manuale di ogni immagine prima della pubblicazione | 2 mesi | R-15 |
| **T-35** | **Politica di retention delle sessioni** più aggressiva: invalidare `DeviceSession` quando l'utente revoca il consenso, non solo alla scadenza naturale | 1 mese | R-13 |
| **T-36** | **Logging strutturato** dell'accesso a dati sanitari da parte degli amministratori (per tracciare ogni lettura, non solo le modifiche) | 6 mesi | R-06, R-09 |

### 4.3. Rischio residuo

Dopo l'applicazione delle misure T-01 — T-20 (già implementate) e T-21 — T-36 (proposte), il rischio residuo per ciascun rischio identificato è ricalcolato come segue:

| ID | Rischio lordo | Rischio residuo | Note |
|---|---|---|---|
| R-01 | 8 | 4 | Mitigato da T-21, T-22, T-26, T-27 |
| R-02 | 6 | 3 | Mitigato da T-08, T-09 |
| R-03 | 8 | 4 | Mitigato da T-04, T-05, T-06, T-07, T-11, T-26 |
| R-04 | 4 | 2 | Mitigato da T-01, T-09 |
| R-05 | 4 | 2 | Mitigato da T-13 |
| R-06 | 8 | 4 | Mitigato da T-21, T-26, T-36 |
| R-07 | 8 | 4 | Mitigato da T-23, T-29 |
| R-08 | 6 | 3 | Mitigato da T-22 |
| R-09 | 6 | 3 | Mitigato da T-15, T-31, T-36 |
| R-10 | 3 | 2 | Mitigato da T-14, T-33 |
| R-11 | 4 | 2 | Mitigato da T-16, T-17, T-18 |
| R-12 | 3 | 1 | Mitigato da T-20, T-29 |
| R-13 | 4 | 2 | Mitigato da T-19, T-24, T-25, T-35 |
| R-14 | 4 | 2 | Mitigato dalla presenza di consensi espliciti separati |
| R-15 | 4 | 2 | Mitigato da T-34 |
| R-16 | 8 | 3 | Mitigato da T-07, T-11 |
| R-17 | 3 | 1 | Mitigato da T-02, T-03, T-10, T-12 |
| R-18 | 4 | 2 | Mitigato da T-11 |
| R-19 | 2 | 1 | Mitigato da T-17 |
| R-20 | 4 | 4 | **Permane**: il Sito non impedisce tecnicamente l'iscrizione di minori < 12 anni; il controllo è dichiarativo. Misura aggiuntiva proposta: blocco a livello di validazione del turno (età minima 12 anni compiuti all'inizio del campo). |

> **Conclusione sull'analisi del rischio.** Dopo l'applicazione delle misure proposte, nessun rischio residuo è classificato come "Elevato" o "Critico". I rischi R-01, R-03, R-06, R-07, R-16 permangono con rischio residuo "Moderato-basso", in linea con la natura del trattamento e l'esposizione limitata (scala locale del Titolare, ~ 250 interessati per stagione).

---

## 5. Consultazione dell'autorità di controllo (art. 36 GDPR)

### 5.1. Obbligo di consultazione preventiva

L'art. 36 GDPR prescrive la consultazione preventiva del Garante per la protezione dei dati personali quando "il trattamento presenta un rischio elevato" e "il Titolare non riesce a mitigarlo con misure adeguate".

Nel caso di specie:

- Il trattamento riguarda **categorie particolari di dati ex art. 9 GDPR** (dati sanitari, dati di minori).
- Il trattamento riguarda **minori** ex art. 8 GDPR.
- Il trattamento è effettuato su larga scala nel senso dell'art. 35(3) lett. b) GDPR? **No**: il Titolare è una Sezione locale con ~ 250-300 interessati per stagione. La "larga scala" va valutata con riferimento al numero di interessati, alla proporzione rispetto alla popolazione di riferimento e alla varietà dei dati (cfr. WP248rev.01, § IV.2.1.B e EDPB Guidelines 4/2019). La soglia numerica non è soddisfatta.
- Le misure di mitigazione proposte (cfr. § 4) portano il rischio residuo a un livello "Moderato-basso".

### 5.2. Conclusioni

**La consultazione preventiva del Garante per la protezione dei dati personali non è obbligatoria**, in quanto:

1. Il trattamento non è di "larga scala" secondo i criteri EDPB;
2. Le misure di mitigazione proposte riducono il rischio residuo a un livello accettabile;
3. I rischi elevati tipici (sorveglianza sistematica, profilazione con effetti giuridici, trattamento di dati biometrici su larga scala) **non ricorrono** nel caso di specie.

Tuttavia, il Titolare si riserva di:

- **Sottoporre volontariamente la presente DPIA al Garante** qualora la designazione del DPO (cfr. § 6.4) ne faccia richiesta;
- **Notificare il Garante in caso di violazione** (art. 33 GDPR) entro 72 ore dalla scoperta;
- **Consultare il Garante preventivamente** qualora, a seguito di modifiche sostanziali dei trattamenti, il rischio residuo torni a livello "Elevato".

### 5.3. Criteri di revisione della DPIA

La presente DPIA sarà revisionata e, se del caso, aggiornata, in occasione di:

- Modifiche sostanziali delle finalità del trattamento;
- Introduzione di nuove categorie di dati personali;
- Introduzione di nuovi responsabili del trattamento o sub-responsabili (in particolare: nuovi fornitori extra-UE);
- Modifiche dell'architettura tecnica che incidano sui flussi di dati;
- Cambiamenti normativi rilevanti (modifiche al Codice privacy, nuovi provvedimenti del Garante);
- Aggiornamento periodico annuale.

---

## 6. Diritti degli interessati

Il Titolare garantisce l'esercizio dei diritti di cui agli artt. 15-22 GDPR. La tabella che segue descrive, per ciascun diritto, le modalità di esercizio e il riferimento tecnico.

| Diritto | Base giuridica | Modalità di esercizio | Implementazione tecnica |
|---|---|---|---|
| **Diritto di accesso** (art. 15) | L'interessato può richiedere una copia dei propri dati | Email al Titolare o sezione "Richiedi i tuoi dati" in `/account` | Estrazione massiva dal DB con `prisma.iscrizione.findUnique` filtrato per `iscrizioneId` della sessione; generazione di un export JSON/CSV. Da implementare T-37 (export automatico dell'area personale) |
| **Diritto di rettifica** (art. 16) | L'interessato può correggere dati inesatti | Area personale `/account/bookings/[id]/update` | `src/app/api/account/booking/[id]/update/route.ts:73-249` |
| **Diritto alla cancellazione** (art. 17) | L'interessato può chiedere la cancellazione | Sezione "Richiedi cancellazione" in `/account` (form gdpr-delete) | `src/app/api/account/gdpr-delete/route.ts:37-117` → notifica email all'amministratore + audit log |
| **Diritto di limitazione** (art. 18) | L'interessato può chiedere la limitazione | Email al Titolare | Da implementare T-38 (flag `restrictedAt` sul modello `Iscrizione`) |
| **Diritto alla portabilità** (art. 20) | L'interessato può ricevere i dati in formato strutturato | Email al Titolare o export in `/account` | Da implementare T-37 (export JSON machine-readable) |
| **Diritto di opposizione** (art. 21) | L'interessato può opporsi al trattamento per finalità di marketing o per legittimo interesse | Unsubscribe dalla newsletter tramite link firmato HMAC (`/api/newsletter/unsubscribe`) | `src/app/api/newsletter/unsubscribe/route.ts:60-86`; `src/lib/newsletterToken.ts:50-84` |
| **Diritto di revoca del consenso** (art. 7(3)) | Il consenso può essere revocato in qualsiasi momento, con la stessa facilità con cui è stato prestato | Email al Titolare o sezione "Gestisci consensi" in `/account` | Da implementare T-39 |

### 6.1. Termini di risposta

Il Titolare risponde alle richieste entro **30 giorni** dal ricevimento, prorogabili di ulteriori 60 giorni in caso di richieste complesse (art. 12(3) GDPR). La risposta è fornita via email all'indirizzo indicato dall'interessato nella richiesta.

### 6.2. Reclamo all'autorità di controllo

L'interessato che ritenga che il trattamento che lo riguarda violi il GDPR ha il diritto di proporre reclamo al Garante per la protezione dei dati personali (Piazza Venezia 11, 00187 Roma — www.garanteprivacy.it), come previsto dall'art. 77 GDPR. Il reclamo può essere proposto anche in aggiunta all'esercizio degli altri diritti.

### 6.3. Contatti per l'esercizio dei diritti

| Canale | Recapito |
|---|---|
| Email del Titolare | [redacted] |
| Email del DPO (da designare) | *(da definire in sede di designazione)* |
| Telefono | [redacted] |
| Posta | WWF Crotone — c/o C.E.L.A., San Leonardo di Cutro (KR) |

### 6.4. Designazione del DPO

In applicazione dell'art. 37(1) GDPR, lett. c) — trattamento sistematico su larga scala di categorie particolari di dati (dati sanitari) — e lett. b) — trattamento che richiede il monitoraggio regolare e sistematico degli interessati su larga scala (concorso, ancorché non su larga scala, di due criteri di cui all'art. 37(1) GDPR) — il Titolare **è tenuto a designare un Responsabile della protezione dei dati (DPO)**.

L'obbligo è discusso in dottrina: parte della dottrina e della prassi del Garante ritiene che, anche in assenza di larga scala, il trattamento sistematico di dati sanitari o di dati di minori sia di per sé sufficiente a far scattare l'obbligo (cfr. WP243rev.01 — linee-guida sui DPO, § 3.1.B). Il Titolare, in via prudenziale, **designa un DPO interno o esterno entro 60 giorni dall'adozione della presente DPIA**, dandone comunicazione al Garante secondo le modalità previste.

> **Raccomandazione R-04 (T-23).** In assenza di verifica documentale del legame di filiazione e dell'identità del genitore, il Titolare non può considerarsi pienamente compliant all'art. 8 GDPR per i minori di età inferiore a 14 anni. Si raccomanda l'introduzione di una procedura di verifica documentale a campione (o sistematica per i turni con capienza limitata) entro 6 mesi dall'adozione della presente DPIA.

---

# PARTE II — ENGLISH VERSION

---

## 1. Description of the Processing

### 1.1. Nature

The WWF Crotone website (the "**Site**") is the digital contact point for organising and managing the summer volunteer camps held annually by the WWF Crotone local section (a local section of WWF Italia ETS) at the C.E.L.A. — Centre for Environmental and Legality Education of San Leonardo di Cutro (KR), Calabria, Italy. The Site collects and processes personal data of adult and minor volunteers (aged 12 to 17) wishing to participate in the camp activities, as well as of their parents or legal guardians.

The processing operations consist of: collection, recording, organisation, storage, consultation, processing, communication and erasure of personal data of data subjects, both in automated form (via the Next.js 15 application) and, residually, in manual form (email correspondence with referents, transmission of payment receipts, correspondence with camp operators).

### 1.2. Context

The processing is carried out by WWF Crotone — a small non-profit organisation, with no salaried staff and operating on a voluntary basis — within its statutory mission of environmental protection and education. The data controller is established in the European Union (Italy).

### 1.3. Purposes

1. **Registration management** for the twelve weekly camp turns (21 June — 13 September 2026): collection of applications, verification of age requirements, management of waiting lists, capacity and duplication checks. Legal basis: Art. 6(1)(b) GDPR — performance of a contract.
2. **Health and safety protection** of participants during field activities (naturalistic excursions, beach cleanups, Caretta caretta nest monitoring): collection of allergies, intolerances, ongoing medications, self-reported fitness, swimming ability, tetanus vaccination status. Legal basis: Art. 9(2)(a) GDPR — explicit consent; and Art. 9(2)(h) GDPR in combination with Art. 2-sexies(2)(t) of Italian Legislative Decree 196/2003.
3. **Legal obligations** relating to safety, insurance and child protection. Legal basis: Art. 6(1)(c) GDPR.
4. **Payment management** of the participation fee and balance, with tracking of bank transfer receipts. Legal basis: Art. 6(1)(b) GDPR.
5. **Newsletter and informational communications** to volunteers who have given specific consent. Legal basis: Art. 6(1)(a) GDPR.
6. **IT security and fraud prevention**: access logging, rate limiting, detection of abuse and attacks. Legal basis: Art. 6(1)(f) GDPR — legitimate interest.
7. **Profiling and aggregated anonymous analytics** on registration flows, geographic origin and demographics. Legal basis: Art. 6(1)(f) GDPR.

### 1.4. Categories of Personal Data

| Category | Type | Special category (Art. 9) |
|---|---|---|
| First and last name | Identifiers | No |
| Date of birth / age | Identifiers | No |
| Email address | Contact | No |
| Phone number | Contact | No |
| Parent/guardian contact data | Identifiers | No |
| **Allergies and dietary intolerances** | Health | **Yes** |
| **Ongoing medication** | Health | **Yes** |
| **Swimming ability** | Health/fitness | **Yes** |
| **Tetanus vaccination status** | Health | **Yes** |
| **Self-reported fitness** | Health | **Yes** |
| Dietary needs (vegetarian/vegan/celiac) | Habits | No |
| T-shirt size | Logistics | No |
| Arrival/departure mode and time | Logistics | No |
| Bank transfer receipts (PDF/JPEG/PNG) | Accounting | No (but contain IBAN) |
| IP address, user-agent | Technical | No |
| **Photographic images** (specific consent) | Biometric/identifying | **Yes** if faces are recognisable |

### 1.5. Categories of Data Subjects

| Category | Age | Origin | Estimated volume (2026 season) |
|---|---|---|---|
| Adult volunteers | 18+ | Italy + EU + non-EU | ~ 200 |
| Minor volunteers | 12-17 | Italy + EU + non-EU | ~ 40 |
| Parents/legal guardians | Adults | Parents of enrolled minors | ~ 60-80 |
| Newsletter subscribers | Mixed | Site visitors | ~ 500 |
| Camp operators | Adults | Internal volunteers | ~ 30 |
| Site administrators | Adults | Internal authorised staff | 2-5 |

### 1.6. Data Flows

```
[Volunteer]                                                          
  │                                                                 
  │ HTTPS / TLS 1.3 (CSP with nonce — see src/middleware.ts)        
  ▼                                                                 
[Site — Next.js 15 + Prisma]                                        
  │                                                                 
  ├──► Cloudflare (CDN)                       [EU/USA, SCC]         
  ├──► Brevo (transactional SMTP)             [EU/FRA, GDPR]        
  ├──► Groq Inc. (chatbot LLM)                [USA, SCC + DPA]      
  ├──► Sentry (error monitoring)              [USA, SCC + DPA]      
  │       • PII filter beforeSend (sentry.server.config.ts)         
  ├──► Google Fonts                           [USA, SCC]            
  └──► Database SQLite (dev) / PostgreSQL (prod)                    
```

### 1.7. Retention Periods

| Data category | Retention period | Legal basis |
|---|---|---|
| Volunteer registration data | 10 years after camp end (tax/rendicontazione) | Art. 6(1)(c) GDPR; Art. 2220 c.c. |
| Health data | 1 year after camp end | Art. 5(1)(e) GDPR — storage limitation |
| Minor data (with parental consent) | As above; earlier deletion on parental request | Art. 17 GDPR |
| Payment receipts | 10 years | Art. 6(1)(c) GDPR; Art. 2220 c.c. |
| Magic-link tokens (SHA-256 hash) | 30 minutes (technical expiry) | Technical necessity |
| Session cookie (httpOnly, 24h) | 24 hours | Technical necessity |
| "Remember device" cookie (30 days) | 30 days | Technical necessity |
| Audit log | 24 months (proposed) | Art. 6(1)(f) GDPR |
| Newsletter (email, consent, IP) | Until consent withdrawn + 30 days | Art. 6(1)(a) GDPR |
| IP, UA of rate-limited requests | 0 (deleted on bucket expiry) | Art. 6(1)(f) GDPR |
| Sentry error logs | 90 days (Sentry default) | Art. 6(1)(f) GDPR |
| Database backups | 30 days (proposed) | Art. 6(1)(c) and (f) GDPR |

---

## 2. Necessity and Proportionality Assessment

### 2.1. Lawful Bases by Purpose

| Purpose | Lawful basis (Art. 6 GDPR) | Special category (Art. 9) | Consent required |
|---|---|---|---|
| Registration management | Art. 6(1)(b) | — | Privacy consent (Art. 7) |
| Health data processing | — | Art. 9(2)(a) explicit consent + Art. 9(2)(h) | Yes, explicit and separate |
| Minor data processing | Art. 6(1)(b) + Art. 8 GDPR | As above, when applicable | Yes, parental consent |
| Payment tracking | Art. 6(1)(b) and (c) | — | Privacy consent |
| Newsletter | Art. 6(1)(a) | — | Yes, opt-in |
| Photographic images | Art. 6(1)(a) | Art. 9(2)(a) for identifying images | Yes, specific |
| IT security | Art. 6(1)(f) | — | Information notice |
| Tax/accounting compliance | Art. 6(1)(c) | — | Information notice |

### 2.2. Consent Mechanisms

- **Freely given**: registration is not conditional on newsletter or image consent (separate opt-ins).
- **Specific**: separate consents for privacy, marketing, images, and each health data purpose.
- **Informed**: the privacy policy link is displayed before the consent flag (`/it/privacy`).
- **Unambiguous**: the flag must be explicitly `true` (Zod schema in `src/app/api/iscrizione/route.ts:39` enforces `v === true`). For minors, the schema additionally requires `guardianName`, `guardianPhone`, `guardianConsent: true` (lines 80-82).
- **Withdrawable**: via email to the Controller or via the personal area ("Request data deletion"), which triggers a written notification to the administrator and an `AuditLog` row.
- **Demonstrable**: the newsletter API stores date, IP and user-agent for each consent (see `src/app/api/newsletter/route.ts:30-37`).

### 2.3. Verification of Minority and Parental Consent

The system implements server-side verification of minority based on date of birth vs. camp start date (see `src/app/api/iscrizione/route.ts:74-79` and `isUnder18` in `src/lib/turns.ts`). In case of mismatch between the client-declared `isMinor` flag and the server-computed age, the request is rejected (`error: "minor-mismatch"`). Verification of parental identity is declarative (free text field); an ID document is not requested. **Recommendation R-04**: introduce a sample-based identity verification procedure (see § 6.4).

### 2.4. Data Minimisation

Optional fields (allergies, medications, fitness) are stored as `null` when not provided. The system does not require completion of any health field to proceed with registration, but they are required to participate in the camp. No tax code, residential address, ID number, profession or biometric data are collected.

### 2.5. Accuracy

The data subject may modify their personal and health data via the personal area (`/account/bookings/[id]/update`) until the turn start date (see `src/lib/bookingLock.ts:60-87`). Personal/contact fields can be modified only until the administrator confirms the volunteer's identity (by setting `personalDataLockedAt`).

### 2.6. Storage Limitation

See § 1.7. In particular: magic-links are stored only as SHA-256 hashes for 30 minutes (`src/lib/magicLink.ts:29`); health data is retained for one year from camp end; newsletter records are kept until consent is withdrawn.

### 2.7. Integrity and Confidentiality

Refer to § 4 for technical and organisational measures (TLS 1.3 + HSTS preload, CSP with per-request nonce, bcrypt password hashing, HMAC-signed session tokens, CSRF validation, rate limiting, single-use magic-links, magic-bytes validation on uploads).

---

## 3. Risk Assessment

### 3.1. Methodology

The risk assessment follows the WP248rev.01 (EDPB) methodology and ISO/IEC 27005:2022. For each identified risk:

- **Probability (P)**: 1 (negligible), 2 (low), 3 (medium), 4 (high)
- **Impact (I)**: 1 (negligible), 2 (contained), 3 (significant), 4 (material)
- **Gross risk (R = P × I)**: 1-4 negligible, 5-8 moderate, 9-12 high, 13-16 critical

### 3.2. Risk Matrix

| ID | Risk description | Affected subjects | P | I | Gross R |
|---|---|---|---|---|---|
| R-01 | Unauthorised DB access (SQLi, DB dump) → exfiltration of personal, health, minor data | All data subjects | 2 | 4 | **8 (Moderate)** |
| R-02 | Abusive access to volunteer personal area (cookie theft) | Adult and minor volunteers | 2 | 3 | **6 (Moderate)** |
| R-03 | Abusive access to admin area (credential theft) | Volunteers, system integrity | 2 | 4 | **8 (Moderate)** |
| R-04 | Magic-link email capture (SMTP interception, mailbox compromise) | Volunteers | 1 | 4 | **4 (Negligible)** |
| R-05 | Malicious file upload (receipts, gallery photos) → code execution | System integrity | 1 | 4 | **4 (Negligible)** |
| R-06 | Health data exposure (ACL misconfiguration or bug) | Volunteers with health data | 2 | 4 | **8 (Moderate)** |
| R-07 | Minor data processed without valid parental consent (false parental identity) | Minors | 2 | 4 | **8 (Moderate)** |
| R-08 | Data loss (disaster, human error) without backup | All data subjects | 2 | 3 | **6 (Moderate)** |
| R-09 | Data breach with delayed notification to Garante / data subjects | All data subjects, reputation | 2 | 3 | **6 (Moderate)** |
| R-10 | Transfer to USA (Groq, Sentry) without adequate safeguards | EU data subjects | 1 | 3 | **3 (Negligible)** |
| R-11 | Chatbot prompt injection → data exfiltration or harmful content | Chatbot users | 2 | 2 | **4 (Negligible)** |
| R-12 | Data use for further purposes (undeclared profiling, aggressive marketing) | Registered volunteers | 1 | 3 | **3 (Negligible)** |
| R-13 | Retention beyond term (no automatic deletion) | All data subjects | 2 | 2 | **4 (Negligible)** |
| R-14 | Health data processing with inadequate legal basis (no explicit consent) | Volunteers with health data | 1 | 4 | **4 (Negligible)** |
| R-15 | Identification of a minor via photo published in gallery | Minors | 1 | 4 | **4 (Negligible)** |
| R-16 | Brute force on admin login | System integrity | 2 | 4 | **8 (Moderate)** |
| R-17 | CSRF on write endpoints (status change, profile edit) | Data integrity | 1 | 3 | **3 (Negligible)** |
| R-18 | Chatbot DoS (Groq quota exhaustion) | Service availability | 2 | 2 | **4 (Negligible)** |
| R-19 | IBAN theft from chatbot output (accidental disclosure) | Users | 1 | 2 | **2 (Negligible)** |
| R-20 | Access by children under 12 (below participation threshold) | Children under 12 | 2 | 2 | **4 (Negligible)** |

### 3.3. Discussion of Main Risks

**R-06 — Health data exposure.** The `Iscrizione` model (`prisma/schema.prisma:68-73`) stores health data in unencrypted text columns. Access is filtered by two layers: admin authentication (`getSession()` in `src/lib/auth.ts:71-91`) and per-turn ACL (`canAccessTurn` in `src/lib/auth.ts:132-136`). For the volunteer personal area, access is limited to the session's `iscrizioneId` (`getAccountSession` in `src/lib/accountSession.ts:196-273`). An application bug (e.g. missing filter in a new admin route) could expose the data. Proposed mitigations: at-rest encryption of health columns (see § 4.2, R-06-mit), automatic access-control tests on every new route.

**R-07 — Unverified parental consent.** The system relies on parental self-declaration (fields `guardianName`, `guardianEmail`, `guardianPhone`, flag `guardianConsent`). No parental ID document is requested. A minor could enrol by declaring a fictitious parent. Proposed mitigations: sample-based ID verification for children under 14.

**R-10 — Transfer to USA (Groq, Sentry).** The chatbot sends text messages to Groq Inc. The system does not inject personal data into user messages, but the user may voluntarily share personal data (mitigated by: system prompt discouraging sharing + regex filter `redactPII` on phone numbers and IBANs, see `src/app/api/chat/route.ts:128-134`). For Sentry, the `beforeSend` filter in `sentry.server.config.ts:24-49` prevents transmission of any personal data for sensitive routes.

---

## 4. Measures to Address the Risks

### 4.1. Technical Measures Already Implemented

| ID | Measure | Implementation | Risks mitigated |
|---|---|---|---|
| T-01 | TLS 1.3 + HSTS preload | `next.config.js:46-48` | R-04, R-05, R-17 |
| T-02 | CSP with per-request nonce | `src/middleware.ts:47-117` | R-11, R-17 |
| T-03 | Security headers (X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy) | `next.config.js:41-44` | R-17 |
| T-04 | bcrypt password hashing for admin | `src/lib/auth.ts:121` | R-03, R-16 |
| T-05 | JWT HS256 with `AUTH_SECRET` validated at boot (rejection of weak secrets) | `src/lib/auth.ts:20-38` | R-03 |
| T-06 | Admin session: `httpOnly`, `Secure`, `SameSite=Strict`, 8h lifetime | `src/lib/auth.ts:96-108` | R-02, R-03 |
| T-07 | Two-factor authentication (TOTP) for admins | `User.totpEnabled` in `prisma/schema.prisma:21-22` | R-03, R-16 |
| T-08 | HMAC-signed "remember device" cookie bound to device fingerprint (UA + Accept-Language) | `src/lib/deviceSession.ts:66-156` | R-02 |
| T-09 | Single-use magic-link, SHA-256 hash of token (never stored in clear), 30-min expiry | `src/lib/magicLink.ts:29-152` | R-04 |
| T-10 | CSRF validation on all non-idempotent routes (POST, PATCH, DELETE) | `validateOrigin` in `src/lib/csrf.ts` | R-17 |
| T-11 | In-memory + Upstash rate limiting keyed on trusted proxy IP | `src/lib/rateLimit.ts:82-104` | R-16, R-18 |
| T-12 | Zod input validation on all API routes | (e.g.) `src/app/api/iscrizione/route.ts:15-43` | R-17 |
| T-13 | Magic-bytes validation (not just MIME) on uploads | `src/app/api/admin/upload/route.ts:50-65`, `src/app/api/account/booking/[id]/receipt/route.ts:18-41` | R-05 |
| T-14 | `beforeSend` Sentry filter for sensitive routes (strips body, cookies, IP) | `sentry.server.config.ts:24-49` | R-10 |
| T-15 | Per-field audit log for every Iscrizione modification | `src/lib/audit.ts:59-81`; `logFieldChange` in `src/app/api/account/booking/[id]/update/route.ts:199-216` | R-09 |
| T-16 | Chatbot prompt-injection protection (regex + Groq Prompt Guard + topic guard) | `src/lib/chatGuard.ts`; `src/app/api/chat/route.ts:58-85, 132-134` | R-11, R-19 |
| T-17 | PII filter on chatbot output (regex on phones and IBANs) | `src/app/api/chat/route.ts:128-134` | R-19 |
| T-18 | Limited tool list (only `check_availability`, read-only) for chatbot | `src/app/api/chat/route.ts:151-227` | R-11 |
| T-19 | Soft-delete (`deletedAt`) on Iscrizioni, Operatori, Gallery, Blog | `prisma/schema.prisma:103, 150, 183, 249` | R-13 |
| T-20 | Recess mechanism (gdpr-delete) producing email notification + audit row | `src/app/api/account/gdpr-delete/route.ts:37-117` | R-12, R-13 |

### 4.2. Technical and Organisational Measures to Be Implemented

| ID | Measure | Timeline | Risks mitigated |
|---|---|---|---|
| T-21 | **At-rest encryption of health columns** (`allergies`, `medications`, `swimmingAbility`, `tetanusStatus`, `fitnessSelf`, `dietaryNotes`) via envelope encryption with HSM/KMS-managed keys, or application-level encryption with per-column keys | 3 months | R-01, R-06 |
| T-22 | **Encrypted database backups** (separate key) and off-site storage (e.g. AWS S3 with SSE-KMS in EU region) | 3 months | R-08 |
| T-23 | **Documentary verification of parental consent** for children < 14: email request of parent ID document at admin-confirmation time | 6 months | R-07 |
| T-24 | **Automatic deletion of health data** 12 months after camp end (cron job) | 3 months | R-13 |
| T-25 | **Automatic deletion of Iscrizioni** 10 years after camp end, unless subject objects | 3 months | R-13 |
| T-26 | **Automatic access-control tests** on every API route that accesses personal data (CI/CD) | 2 months | R-01, R-06 |
| T-27 | **Annual penetration test** of the Site (including APIs and admin panel) by an independent third party | Annual | R-01, R-02, R-03 |
| T-28 | **Annual DPIA refresh** or in case of material changes | Annual | All |
| T-29 | **Staff training** (volunteer workforce) on personal data protection, with focus on health and minor data | Annual | R-07, R-12, R-14 |
| T-30 | **Record of processing activities** updated ex Art. 30 GDPR | 1 month | R-01 |
| T-31 | **Breach notification to Garante within 72h** (Art. 33 GDPR): documented procedure, defined responsibilities | 1 month | R-09 |
| T-32 | **Designation of DPO** (see § 6.4): mandatory under Art. 37(1)(c) GDPR — systematic processing of health data on a large scale | Immediate | R-09, R-14 |
| T-33 | **Transfer Impact Assessment (TIA)** for Groq Inc. and Sentry Inc., with identification of supplementary measures | 6 months | R-10 |
| T-34 | **Specific clauses on minor image processing** in gallery: specific consent request and manual review of every image before publication | 2 months | R-15 |
| T-35 | **More aggressive session retention policy**: invalidate `DeviceSession` when user revokes consent, not only at natural expiry | 1 month | R-13 |
| T-36 | **Structured logging of admin reads** of health data (track every read, not only modifications) | 6 months | R-06, R-09 |

### 4.3. Residual Risk

After implementation of T-01 — T-20 (already in place) and T-21 — T-36 (proposed), no residual risk remains "High" or "Critical". Risks R-01, R-03, R-06, R-07, R-16 retain a "Moderate-low" residual level, in line with the nature of the processing and the limited exposure (local section, ~ 250 subjects per season).

---

## 5. Consultation with the Supervisory Authority (Art. 36 GDPR)

### 5.1. Mandatory Prior Consultation

Art. 36 GDPR prescribes prior consultation with the Garante when the processing presents a "high risk" and the Controller cannot mitigate it with adequate measures.

In the present case:

- The processing concerns **special categories of data ex Art. 9 GDPR** (health, minors).
- The processing concerns **minors ex Art. 8 GDPR**.
- The processing is **not on a large scale** within the meaning of Art. 35(3)(b) GDPR: the Controller is a local section with ~ 250-300 subjects per season. The "large scale" threshold is not met.
- The proposed mitigation measures (see § 4) bring the residual risk to an "Acceptable / Moderate-low" level.

### 5.2. Conclusion

**Prior consultation with the Garante is not mandatory**, because:

1. The processing is not on a large scale according to EDPB criteria;
2. The proposed mitigation measures reduce the residual risk to an acceptable level;
3. The high-risk scenarios typically triggering the obligation (systematic monitoring, profiling with legal effects, large-scale biometric processing) **do not apply**.

The Controller reserves the right to:

- **Voluntarily submit the present DPIA to the Garante** if the designated DPO so requests;
- **Notify the Garante in case of breach** (Art. 33 GDPR) within 72 hours of discovery;
- **Consult the Garante preventively** if, following material changes to the processing, the residual risk returns to a "High" level.

### 5.3. DPIA Review Triggers

This DPIA will be reviewed and, if necessary, updated upon:

- Material changes to the processing purposes;
- Introduction of new categories of personal data;
- Introduction of new processors or sub-processors (notably: new non-EU providers);
- Changes to the technical architecture that affect data flows;
- Relevant regulatory changes (amendments to the Codice privacy, new Garante measures);
- Annual periodic update.

---

## 6. Data Subject Rights

The Controller guarantees the exercise of the rights under Art. 15-22 GDPR. The following table describes, for each right, the exercise modalities and the technical reference.

| Right | Legal basis | Exercise modality | Technical implementation |
|---|---|---|---|
| **Right of access** (Art. 15) | Data subject may request a copy of their data | Email to Controller or "Request your data" section in `/account` | Mass extraction from DB with `prisma.iscrizione.findUnique` filtered by session's `iscrizioneId`; JSON/CSV export. To be implemented T-37 |
| **Right of rectification** (Art. 16) | Data subject may correct inaccurate data | Personal area `/account/bookings/[id]/update` | `src/app/api/account/booking/[id]/update/route.ts:73-249` |
| **Right to erasure** (Art. 17) | Data subject may request deletion | "Request deletion" section in `/account` (gdpr-delete form) | `src/app/api/account/gdpr-delete/route.ts:37-117` → email notification to admin + audit log |
| **Right to restriction** (Art. 18) | Data subject may request restriction | Email to Controller | To be implemented T-38 (flag `restrictedAt` on `Iscrizione` model) |
| **Right to data portability** (Art. 20) | Data subject may receive data in structured format | Email to Controller or export in `/account` | To be implemented T-37 (machine-readable JSON export) |
| **Right to object** (Art. 21) | Data subject may object to processing for marketing or legitimate interest | Unsubscribe from newsletter via HMAC-signed link (`/api/newsletter/unsubscribe`) | `src/app/api/newsletter/unsubscribe/route.ts:60-86`; `src/lib/newsletterToken.ts:50-84` |
| **Right to withdraw consent** (Art. 7(3)) | Consent may be withdrawn at any time, with the same ease as it was given | Email to Controller or "Manage consents" section in `/account` | To be implemented T-39 |

### 6.1. Response Times

The Controller responds to requests within **30 days** of receipt, extendable by a further 60 days in case of complex requests (Art. 12(3) GDPR). The response is sent by email to the address indicated by the data subject.

### 6.2. Complaint to the Supervisory Authority

The data subject who considers that the processing concerning them infringes the GDPR has the right to lodge a complaint with the Garante per la protezione dei dati personali (Piazza Venezia 11, 00187 Roma — www.garanteprivacy.it), as provided by Art. 77 GDPR.

### 6.3. Contact Details for Rights Exercise

| Channel | Contact |
|---|---|
| Controller email | [redacted] |
| DPO email (to be designated) | *(to be defined upon designation)* |
| Phone | [redacted] |
| Postal address | WWF Crotone — c/o C.E.L.A., San Leonardo di Cutro (KR) |

### 6.4. DPO Designation

Pursuant to Art. 37(1) GDPR, lett. c) — systematic processing on a large scale of special categories of data (health data) — and lett. b) — processing requiring regular and systematic monitoring of data subjects on a large scale (combined effect of two Art. 37(1) criteria) — the Controller **is required to designate a Data Protection Officer (DPO)**.

The obligation is discussed in doctrine: part of the doctrine and practice of the Garante holds that, even in the absence of large scale, the systematic processing of health data or minor data is in itself sufficient to trigger the obligation (see WP243rev.01 — DPO guidelines, § 3.1.B). The Controller, as a precaution, **designates an internal or external DPO within 60 days of adoption of this DPIA**, notifying the Garante according to the prescribed modalities.

> **Recommendation R-04 (T-23).** In the absence of documentary verification of the parent-child relationship and parental identity, the Controller cannot consider itself fully compliant with Art. 8 GDPR for children under 14. We recommend the introduction of a sample-based (or systematic for low-capacity turns) documentary verification procedure within 6 months of adoption of this DPIA.

---

## Appendice — Mappa dei file rilevanti / Appendix — File Map

| Sezione DPIA | File di riferimento | Note |
|---|---|---|
| Trattamento principale di iscrizione | `src/app/api/iscrizione/route.ts` | Validazione Zod, verifica minore età, scrittura DB, invio email |
| Magic-link | `src/lib/magicLink.ts`, `src/app/api/account/magic-link/route.ts` | Hash SHA-256, monouso, scadenza 30 min |
| Sessione volontario | `src/lib/accountSession.ts`, `src/lib/deviceSession.ts` | Cookie HMAC, binding al fingerprint del dispositivo |
| Autenticazione amministratore | `src/lib/auth.ts` | JWT, bcrypt, TOTP |
| Modello dati | `prisma/schema.prisma` | Definizione di tutti i campi personali, sanitari, di minori |
| Audit log | `src/lib/audit.ts` | Scrittura per-field delle modifiche |
| Modifica profilo | `src/app/api/account/booking/[id]/update/route.ts` | Editing per-field con lock |
| Cancellazione (gdpr-delete) | `src/app/api/account/gdpr-delete/route.ts` | Recesso con notifica admin |
| Caricamento ricevute | `src/app/api/account/booking/[id]/receipt/route.ts`, `src/app/api/admin/receipt/route.ts` | Magic-bytes, validazione CSRF, ACL per turno |
| Caricamento galleria | `src/app/api/admin/upload/route.ts` | Magic-bytes, solo superadmin |
| Chatbot | `src/app/api/chat/route.ts`, `src/lib/chatbot-knowledge.ts`, `src/lib/chatGuard.ts` | Guard prompt injection, filtro PII output |
| Newsletter | `src/app/api/newsletter/route.ts`, `src/app/api/newsletter/unsubscribe/route.ts`, `src/lib/newsletterToken.ts` | Consenso esplicito, unsubscribe HMAC |
| Email transazionali | `src/lib/mail.ts` | Provider Brevo/Gmail, escape HTML |
| Rate limiting | `src/lib/rateLimit.ts` | Upstash + memory, chiave su trusted proxy |
| CSP / Sicurezza HTTP | `src/middleware.ts`, `next.config.js` | CSP con nonce, HSTS, security headers |
| Sentry PII filter | `sentry.server.config.ts` | Strip body/cookie/headers per route sensibili |
| Sito config | `src/config/site.ts` | Email, telefono, IBAN pubblico |

---

*Fine del documento — End of document*
