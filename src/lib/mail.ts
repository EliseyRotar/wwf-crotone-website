import nodemailer from "nodemailer";
import { SITE } from "@/config/site";

let transporter: nodemailer.Transporter | null = null;

/**
 * Transactional email provider toggle.
 *
 * Default (USE_BREVO_EMAIL="true"): Brevo SMTP. The free tier gives us
 * 300 emails/day which covers the camp's peak registration window.
 * SMTP_HOST / SMTP_PORT / SMTP_SECURE are taken as-is and should point
 * at `smtp-relay.brevo.com:587` per .env.example. SMTP_USER / SMTP_PASS
 * hold a Brevo SMTP key (NOT the account password).
 *
 * Fallback (USE_BREVO_EMAIL="false"): Gmail SMTP via an App Password.
 * When the toggle is off we hardcode the host/port/secure to Gmail's
 * documented SSL endpoint (smtp.gmail.com:465, secure=true) and
 * override the env vars, so an operator only has to flip the flag and
 * point SMTP_USER / SMTP_PASS at a Gmail address + 16-char App
 * Password (https://myaccount.google.com/apppasswords). They don't
 * need to remember to re-edit SMTP_HOST / SMTP_PORT / SMTP_SECURE.
 *
 * When to flip:
 *   - Brevo daily quota exhausted (rare, only during a bulk-send spike)
 *   - Brevo outage, or SMTP key rotated and not yet propagated
 *   - Local dev where Brevo is overkill and a personal Gmail is fine
 *
 * The `transporter` is cached at module scope, so changing
 * USE_BREVO_EMAIL requires a server restart to take effect.
 */
function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    console.warn("SMTP not configured — emails will be skipped");
    return null;
  }
  const useBrevo = process.env.USE_BREVO_EMAIL === "true";
  const host = useBrevo
    ? (process.env.SMTP_HOST ?? "smtp-relay.brevo.com")
    : "smtp.gmail.com";
  const port = useBrevo
    ? Number(process.env.SMTP_PORT ?? 587)
    : 465;
  const secure = useBrevo
    ? (process.env.SMTP_SECURE ?? "false") === "true"
    : true;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
  return transporter;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendNotification(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}) {
  try {
    const t = getTransporter();
    if (!t) return false;
    await t.sendMail({
      from: `"WWF Crotone" <noreply@wwfcrotone.it>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      attachments: opts.attachments
    });
    return true;
  } catch (err) {
    console.error("mail send failed:", err);
    return false;
  }
}

export async function notifyNewIscrizione(data: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string | null;
  age: number | null;
  isMinor: boolean;
  guardianName?: string | null;
  guardianEmail?: string | null;
  guardianPhone?: string | null;
  guardianConsent?: boolean;
  allergies?: string | null;
  medications?: string | null;
  swimmingAbility?: string | null;
  tetanusStatus?: string | null;
  fitnessSelf?: string | null;
  dietaryNeeds?: string | null;
  dietaryNotes?: string | null;
  tshirtSize?: string | null;
  arrivalMode?: string | null;
  arrivalTime?: string | null;
  departureTime?: string | null;
  privacyConsent: boolean;
  marketingConsent: boolean;
  imageDataConsent: boolean;
  notes?: string | null;
  turno: string;
  turnoStart?: string;
  turnoEnd?: string;
  extraTurni?: string[];
  locale: string;
  adminPanelUrl?: string;
}) {
  // ─── HTML email ───
  // Inline CSS only (Gmail / Outlook strip <style> blocks).
  // Layout is a 2-column key/value grid that stacks on narrow viewports.
  const escapeHtml = (s: string | null | undefined) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

  const yesNo = (v: boolean) => (v ? "✅ Sì" : "❌ No");
  const turnoDisplay = data.turno + (data.turnoStart && data.turnoEnd ? ` (${data.turnoStart} → ${data.turnoEnd})` : "");
  const extraTurniHtml = data.extraTurni && data.extraTurni.length > 0
    ? `<tr><td style="padding:6px 10px;border-bottom:1px solid #f0e6da;background:#fdfaf5;width:35%;color:#707070;font-size:13px;vertical-align:top"><strong>Altri turni</strong></td><td style="padding:6px 10px;border-bottom:1px solid #f0e6da;font-size:14px;color:#101010">${data.extraTurni.map(escapeHtml).join(", ")}</td></tr>`
    : "";

  const adminUrl = data.adminPanelUrl ?? (process.env.NEXT_PUBLIC_SITE_URL ?? "") + "/admin/iscrizioni";

  const rows = [
    ["<strong>Nome e cognome</strong>", `${escapeHtml(data.firstName)} ${escapeHtml(data.lastName)}`],
    ["<strong>Email</strong>", `<a href="mailto:${escapeHtml(data.email)}" style="color:#007932;text-decoration:underline">${escapeHtml(data.email)}</a>`],
    ["<strong>Telefono</strong>", `<a href="tel:${escapeHtml(data.phone)}" style="color:#007932;text-decoration:underline">${escapeHtml(data.phone)}</a>`],
    ["<strong>Data di nascita</strong>", `${escapeHtml(data.birthDate ?? "—")} (${data.age ?? "—"} anni)`],
    ["<strong>Turno principale</strong>", escapeHtml(turnoDisplay)],
    extraTurniHtml,
    ["<strong>Minorenne</strong>", data.isMinor ? "✅ Sì" : "❌ No"],
    data.isMinor
      ? [
          "<strong>Genitore/tutore</strong>",
          `${escapeHtml(data.guardianName ?? "—")} · ${escapeHtml(data.guardianEmail ?? "—")} · ${escapeHtml(data.guardianPhone ?? "—")}<br/><small style="color:#707070">Consenso firmato: ${yesNo(!!data.guardianConsent)}</small>`
        ]
      : [],
    [
      "<strong>Allergie / condizioni mediche</strong>",
      data.allergies
        ? `<span style="color:#ed2b00;font-weight:600">${escapeHtml(data.allergies)}</span>`
        : '<span style="color:#9c9c98">Nessuna</span>'
    ],
    ["<strong>Farmaci</strong>", escapeHtml(data.medications) || '<span style="color:#9c9c98">Nessuno</span>'],
    ["<strong>Nuoto</strong>", escapeHtml(data.swimmingAbility) || "—"],
    ["<strong>Tetano</strong>", escapeHtml(data.tetanusStatus) || "—"],
    ["<strong>Autovalutazione forma fisica</strong>", escapeHtml(data.fitnessSelf) || "—"],
    ["<strong>Esigenze alimentari</strong>", escapeHtml(data.dietaryNeeds) || "Nessuna"],
    ["<strong>Note alimentari</strong>", escapeHtml(data.dietaryNotes) || "—"],
    ["<strong>Taglia T-shirt</strong>", escapeHtml(data.tshirtSize) || "—"],
    [
      "<strong>Modalità di arrivo</strong>",
      `${escapeHtml(data.arrivalMode) || "—"}` +
        (data.arrivalTime ? ` &nbsp;<small style="color:#707070">ore ${escapeHtml(data.arrivalTime)}</small>` : "") +
        (data.departureTime ? ` &nbsp;<small style="color:#707070">partenza ore ${escapeHtml(data.departureTime)}</small>` : "")
    ],
    [
      "<strong>Consensi</strong>",
      `Privacy: ${yesNo(data.privacyConsent)}<br/>Marketing: ${yesNo(data.marketingConsent)}<br/>Immagini: ${yesNo(data.imageDataConsent)}<br/>`
    ],
    ["<strong>Note admin (lasciate dal volontario)</strong>", escapeHtml(data.notes) || '<span style="color:#9c9c98">Nessuna</span>']
  ].flat().filter(Boolean);

  const rowsHtml = rows
    .map(
      (pair) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #f0e6da;background:#fdfaf5;width:35%;color:#707070;font-size:13px;vertical-align:top"><strong>${pair[0]}</strong></td><td style="padding:8px 12px;border-bottom:1px solid #f0e6da;font-size:14px;color:#101010;line-height:1.4">${pair[1]}</td></tr>`
    )
    .join("");

  const subject = `Nuova iscrizione ricevuta — ${data.firstName} ${data.lastName} (${data.turno})`.replace(/[\r\n]/g, " ");

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f6f2ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#101010">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f6f2ed;padding:24px 16px">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #cecece;border-radius:8px;overflow:hidden">
      <!-- Header -->
      <tr><td style="background:#007932;padding:20px 24px;color:#ffffff;font-family:Oswald,'Arial Narrow',Arial,sans-serif">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
          <td style="vertical-align:middle">
            <p style="margin:0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.85">WWF Crotone · Pannello admin</p>
            <h1 style="margin:4px 0 0;font-size:22px;font-weight:600;letter-spacing:-0.01em">Nuova iscrizione ricevuta</h1>
          </td>
        </tr></table>
      </td></tr>
      <!-- Intro -->
      <tr><td style="padding:24px 24px 8px;font-size:15px;line-height:1.5">
        <p style="margin:0 0 8px"><strong>${escapeHtml(data.firstName)} ${escapeHtml(data.lastName)}</strong> ha appena inviato il modulo di iscrizione al campo di volontariato.</p>
        <p style="margin:0;color:#707070;font-size:13px">Ricevuta il ${new Date().toLocaleString("it-IT", { dateStyle: "full", timeStyle: "short" })} · lingua: ${escapeHtml(data.locale).toUpperCase()}</p>
      </td></tr>
      <!-- All details -->
      <tr><td style="padding:8px 16px 16px">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border:1px solid #f0e6da;border-radius:6px;overflow:hidden">
          ${rowsHtml}
        </table>
      </td></tr>
      <!-- CTA -->
      <tr><td align="center" style="padding:8px 24px 24px">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="background:#007932;border-radius:6px">
          <a href="${escapeHtml(adminUrl)}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.01em">Apri nel pannello admin →</a>
        </td></tr></table>
        <p style="margin:12px 0 0;color:#9c9c98;font-size:12px">Il link apre direttamente /admin/iscrizioni filtrato sul turno.</p>
      </td></tr>
      <!-- Footer -->
      <tr><td style="background:#fdfaf5;padding:14px 24px;border-top:1px solid #f0e6da;color:#707070;font-size:11px;line-height:1.5">
        <p style="margin:0">Inviato automaticamente dal sistema di iscrizioni di <strong style="color:#007932">wwfcrotone.it</strong>. Non rispondere a questa email.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const text = `
Nuova iscrizione al campo di volontariato WWF Crotone
Ricevuta il ${new Date().toLocaleString("it-IT")} · lingua: ${data.locale}

Nome e cognome: ${data.firstName} ${data.lastName}
Email: ${data.email}
Telefono: ${data.phone}
Data di nascita: ${data.birthDate ?? "—"} (${data.age ?? "—"} anni)
Turno principale: ${turnoDisplay}
${data.extraTurni && data.extraTurni.length > 0 ? `Altri turni: ${data.extraTurni.join(", ")}\n` : ""}Minorenne: ${data.isMinor ? "Sì" : "No"}
${data.isMinor ? `Genitore/tutore: ${data.guardianName ?? "—"} · ${data.guardianEmail ?? "—"} · ${data.guardianPhone ?? "—"} (consenso firmato: ${data.guardianConsent ? "Sì" : "No"})\n` : ""}Allergie/condizioni mediche: ${data.allergies ?? "Nessuna"}
Farmaci: ${data.medications ?? "Nessuno"}
Nuoto: ${data.swimmingAbility ?? "—"}
Tetano: ${data.tetanusStatus ?? "—"}
Autovalutazione forma fisica: ${data.fitnessSelf ?? "—"}
Esigenze alimentari: ${data.dietaryNeeds ?? "Nessuna"}
Note alimentari: ${data.dietaryNotes ?? "—"}
Taglia T-shirt: ${data.tshirtSize ?? "—"}
Modalità di arrivo: ${data.arrivalMode ?? "—"}${data.arrivalTime ? ` ore ${data.arrivalTime}` : ""}${data.departureTime ? ` (partenza ore ${data.departureTime})` : ""}
Consensi: privacy=${data.privacyConsent ? "Sì" : "No"}, marketing=${data.marketingConsent ? "Sì" : "No"}, immagini=${data.imageDataConsent ? "Sì" : "No"}
Note admin: ${data.notes ?? "Nessuna"}

Apri nel pannello admin: ${adminUrl}
  `.trim();

  return sendNotification({
    to: process.env.ADMIN_NOTIFY_EMAIL ?? SITE.email,
    subject,
    text,
    html
  });
}

export async function sendVolunteerConfirmation(data: {
  email: string;
  firstName: string;
  lastName: string;
  turns: { number: number; startDate: string; endDate: string }[];
  totalCost: number;
  locale: string;
}) {
  const isIt = data.locale === "it";
  const turnLines = data.turns
    .map((t) => `Campo ${t.number}: ${t.startDate} → ${t.endDate}`)
    .join("\n");
  const turnHtml = data.turns
    .map((t) => `<tr><td>Campo ${t.number}</td><td>${t.startDate} → ${t.endDate}</td></tr>`)
    .join("");

  // F2: Build a single .ics file covering all chosen turns.
  const icsAttachments: { filename: string; content: Buffer; contentType?: string }[] = [];
  try {
    const ics = buildIcsForTurns(data.turns, data.firstName, data.lastName, data.locale);
    icsAttachments.push({
      filename: "iscrizione-wwf-crotone.ics",
      content: Buffer.from(ics, "utf-8"),
      contentType: "text/calendar; method=REQUEST; charset=UTF-8"
    });
  } catch (err) {
    console.error("ICS build failed:", err);
  }

  const subject = isIt
    ? `Conferma iscrizione — WWF Crotone Campi di Volontariato 2026`
    : `Registration confirmation — WWF Crotone Volunteer Camps 2026`;

  const text = isIt
    ? `Ciao ${data.firstName},

La tua iscrizione al campo di volontariato WWF Crotone è stata ricevuta.

Turni:
${turnLines}

Totale: €${data.totalCost}

Per confermare la tua iscrizione, versa la quota di €100 tramite bonifico:
IBAN: ${SITE.iban}
Causale: Iscrizione di: ${data.firstName} ${data.lastName}, numero del campo scelto

Il saldo (€${data.totalCost - 100}) va versato almeno una settimana prima dell'inizio del campo.

Trovi la lista di cosa portare qui: ${process.env.NEXT_PUBLIC_SITE_URL}/${data.locale}/packing-list

Ti contatteremo a breve per confermare la tua iscrizione.

— WWF Crotone`
    : `Hello ${data.firstName},

Your registration for the WWF Crotone volunteer camp has been received.

Turns:
${turnLines}

Total: €${data.totalCost}

To confirm your registration, pay the €100 fee via bank transfer:
IBAN: ${SITE.iban}
Reason: Registration of: ${data.firstName} ${data.lastName}, chosen camp number

The balance (€${data.totalCost - 100}) is due at least one week before the camp starts.

Find the packing list here: ${process.env.NEXT_PUBLIC_SITE_URL}/${data.locale}/packing-list

We will contact you shortly to confirm your registration.

— WWF Crotone`;

  const html = isIt
    ? `<h2>Ciao ${escapeHtml(data.firstName)},</h2>
<p>La tua iscrizione al campo di volontariato WWF Crotone è stata ricevuta.</p>
<h3>Turni:</h3>
<table style="border-collapse:collapse">${turnHtml}</table>
<p><strong>Totale: €${data.totalCost}</strong></p>
<h3>Pagamento</h3>
<p>Per confermare la tua iscrizione, versa la quota di €100 tramite bonifico:</p>
<p><strong>IBAN:</strong> ${SITE.iban}<br/>
<strong>Causale:</strong> Iscrizione di: ${escapeHtml(data.firstName)} ${escapeHtml(data.lastName)}, numero del campo scelto</p>
<p>Il saldo (€${data.totalCost - 100}) va versato almeno una settimana prima dell'inizio del campo.</p>
<p>Trovi la lista di cosa portare qui: <a href="${process.env.NEXT_PUBLIC_SITE_URL}/${data.locale}/packing-list">Lista cosa portare</a></p>
<p>Ti contatteremo a breve per confermare la tua iscrizione.</p>
<p>— WWF Crotone</p>`
    : `<h2>Hello ${escapeHtml(data.firstName)},</h2>
<p>Your registration for the WWF Crotone volunteer camp has been received.</p>
<h3>Turns:</h3>
<table style="border-collapse:collapse">${turnHtml}</table>
<p><strong>Total: €${data.totalCost}</strong></p>
<h3>Payment</h3>
<p>To confirm your registration, pay the €100 fee via bank transfer:</p>
<p><strong>IBAN:</strong> ${SITE.iban}<br/>
<strong>Reason:</strong> Registration of: ${escapeHtml(data.firstName)} ${escapeHtml(data.lastName)}, chosen camp number</p>
<p>The balance (€${data.totalCost - 100}) is due at least one week before the camp starts.</p>
<p>Find the packing list here: <a href="${process.env.NEXT_PUBLIC_SITE_URL}/${data.locale}/packing-list">Packing list</a></p>
<p>We will contact you shortly to confirm your registration.</p>
<p>— WWF Crotone</p>`;

  return sendNotification({ to: data.email, subject, text, html, attachments: icsAttachments });
}

/**
 * F2: Build an RFC 5545 iCalendar file with one VEVENT per turn.
 * Dates are in the Italian "dd/MM/yyyy" format that the caller passes in,
 * so we parse them back to a Date here.
 */
function buildIcsForTurns(
  turns: { number: number; startDate: string; endDate: string }[],
  firstName: string,
  lastName: string,
  locale: string
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WWF Crotone//Campi di Volontariato//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST"
  ];

  const parseDate = (s: string): Date => {
    const parts = s.split("/");
    if (parts.length === 3) {
      const [d, m, y] = parts;
      return new Date(Number(y), Number(m) - 1, Number(d));
    }
    return new Date(s);
  };

  const fmtIcs = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  };

  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}T${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}Z`;
  const summary = (locale === "it" ? "Campo WWF Crotone #" : "WWF Crotone Camp #");

  for (const t of turns) {
    const start = parseDate(t.startDate);
    const end = parseDate(t.endDate);
    const dtstart = fmtIcs(start);
    // ICS DTEND is exclusive — add one day so the event covers the full last day
    const endPlus = new Date(end);
    endPlus.setDate(endPlus.getDate() + 1);
    const dtend = fmtIcs(endPlus);
    const uid = `wwf-crotone-${t.number}-${dtstart}@wwfcrotone.it`;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dtstart}`,
      `DTEND;VALUE=DATE:${dtend}`,
      `SUMMARY:${summary}${t.number}`,
      `DESCRIPTION:${locale === "it" ? "Campo di volontariato WWF Crotone — settimana " : "WWF Crotone volunteer camp — week "}${t.number}`,
      "LOCATION:C.E.L.A.\\, San Leonardo di Cutro (KR)",
      "STATUS:CONFIRMED",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export async function sendBulkEmail(opts: {
  to: string[];
  subject: string;
  body: string;
  locale: string;
}) {
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
<h2 style="color:#007932">${escapeHtml(opts.subject)}</h2>
<div style="white-space:pre-wrap;color:#262626;line-height:1.6">${escapeHtml(opts.body)}</div>
<hr style="border:none;border-top:1px solid #cecece;margin:20px 0"/>
<p style="font-size:12px;color:#707070">WWF Crotone — Sezione locale di WWF Italia ETS<br/>wwfcrotone26@gmail.com</p>
</div>`;
  const text = `${opts.subject}\n\n${opts.body}\n\n— WWF Crotone`;

  const t = getTransporter();
  if (!t) return false;

  const CHUNK_SIZE = 50;
  const chunks: string[][] = [];
  for (let i = 0; i < opts.to.length; i += CHUNK_SIZE) {
    chunks.push(opts.to.slice(i, i + CHUNK_SIZE));
  }

  try {
    let allAccepted = true;
    for (const chunk of chunks) {
      const info = await t.sendMail({
        from: `"WWF Crotone" <noreply@wwfcrotone.it>`,
        bcc: chunk.join(", "),
        subject: opts.subject,
        text,
        html
      });
      const accepted = info.accepted as string[] | undefined;
      if (!accepted || accepted.length < chunk.length) {
        allAccepted = false;
      }
    }
    return allAccepted;
  } catch (err) {
    console.error("bulk mail send failed:", err);
    return false;
  }
}

/**
 * Phase 1: send a magic-link sign-in email for the volunteer personal
 * area. The link is single-use and expires in 30 minutes — both are
 * stated explicitly in the copy.
 *
 * Returns `{ ok: true }` on a clean send, `{ ok: false, error }` on
 * any transport failure or when SMTP is not configured. We never throw
 * — the API route will treat both outcomes as "user-facing message
 * sent" so the public response can stay uniform.
 */
export async function sendMagicLink(opts: {
  to: string;
  url: string;
  locale: "it" | "en";
}): Promise<{ ok: boolean; error?: string }> {
  const isIt = opts.locale === "it";
  const safeUrl = escapeHtml(opts.url);
  const subject = isIt
    ? "Accedi alla tua area personale — WWF Crotone"
    : "Access your personal area — WWF Crotone";

  const text = isIt
    ? `Ciao,

Hai richiesto un link per accedere alla tua area personale WWF Crotone.

Clicca qui per accedere (valido 30 minuti):
${opts.url}

Se non hai richiesto tu questo link, puoi ignorare questa email.

— WWF Crotone`
    : `Hello,

You requested a sign-in link to your WWF Crotone personal area.

Click here to sign in (valid for 30 minutes):
${opts.url}

If you didn't request this link, you can safely ignore this email.

— WWF Crotone`;

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#ffffff;color:#262626">
  <div style="border-top:4px solid #007932;padding-top:20px;margin-bottom:20px">
    <h1 style="font-family:Arial,Helvetica,sans-serif;color:#007932;margin:0 0 8px 0;font-size:22px">WWF Crotone</h1>
    <p style="margin:0;color:#707070;font-size:13px">${isIt ? "Area personale volontari" : "Volunteer personal area"}</p>
  </div>
  <h2 style="font-size:20px;margin:0 0 16px 0">${isIt ? "Accedi alla tua area personale" : "Access your personal area"}</h2>
  <p>${isIt
    ? "Hai richiesto un link per accedere alla tua area personale. Clicca il pulsante qui sotto per accedere."
    : "You requested a sign-in link to your personal area. Click the button below to sign in."}</p>
  <p style="margin:28px 0">
    <a href="${safeUrl}" style="display:inline-block;background:#007932;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">
      ${isIt ? "Accedi ora" : "Sign in now"}
    </a>
  </p>
  <p style="font-size:14px;color:#707070">
    ${isIt ? "Oppure copia e incolla questo link nel browser:" : "Or copy and paste this link in your browser:"}<br/>
    <span style="word-break:break-all;color:#007932">${safeUrl}</span>
  </p>
  <p style="font-size:14px;color:#9b1c1c;margin-top:24px">
    <strong>${isIt ? "Questo link scade tra 30 minuti" : "This link expires in 30 minutes"}</strong> ${isIt
      ? "e può essere usato una sola volta."
      : "and can be used only once."}
  </p>
  <hr style="border:none;border-top:1px solid #cecece;margin:24px 0"/>
  <p style="font-size:12px;color:#707070">
    ${isIt
      ? "Se non hai richiesto tu questo link, puoi ignorare questa email in tutta sicurezza."
      : "If you didn't request this link, you can safely ignore this email."}
  </p>
  <p style="font-size:12px;color:#707070;margin-top:24px">
    WWF Crotone — Sezione locale di WWF Italia ETS<br/>
    wwfcrotone26@gmail.com
  </p>
</div>`;

  try {
    const t = getTransporter();
    if (!t) return { ok: false, error: "smtp-not-configured" };
    await t.sendMail({
      from: `"WWF Crotone" <info@wwfcrotone.it>`,
      to: opts.to,
      subject,
      text,
      html
    });
    return { ok: true };
  } catch (err) {
    console.error("magic-link mail send failed:", err);
    return { ok: false, error: "send-failed" };
  }
}

/* =====================================================================
 * Phase 2: full user-flow emails (registration confirmation, status
 * change notifications to admin, receipt upload notifications).
 * =====================================================================
 *
 * These are appended to the existing mail module rather than shipped
 * as a separate file so the SMTP-transporter / config-site imports
 * stay co-located. Each function returns the same { ok, error? } shape
 * as sendMagicLink so API routes can branch uniformly.
 */

/**
 * Send the post-submit confirmation email to the volunteer. Contains a
 * single magic link to /it/account/verify?token=... that, when
 * clicked, advances their Iscrizione from "pending" to "email_verified"
 * via POST /api/iscrizione/[id]/verify-email.
 *
 * The "From" address is the dedicated noreply@wwfcrotone.it mailbox
 * (vs. info@wwfcrotone.it for admin notifications) so the volunteer
 * can reply only to the admin one.
 */
export async function sendRegistrationConfirmation(opts: {
  to: string;
  firstName: string;
  lastName: string;
  verifyUrl: string;
  locale: "it" | "en";
}): Promise<{ ok: boolean; error?: string }> {
  const isIt = opts.locale === "it";
  const safeUrl = escapeHtml(opts.verifyUrl);
  const first = escapeHtml(opts.firstName);
  const subject = isIt
    ? "Conferma la tua iscrizione — WWF Crotone"
    : "Confirm your registration — WWF Crotone";

  const text = isIt
    ? `Ciao ${opts.firstName},

grazie per esserti iscritto/a ai campi di volontariato WWF Crotone.

Per completare l'iscrizione e sbloccare il caricamento della ricevuta di pagamento, clicca questo link (valido 24 ore):

${opts.verifyUrl}

Se non hai richiesto tu questa email, puoi ignorarla.

A presto,
— WWF Crotone`
    : `Hi ${opts.firstName},

thank you for signing up for the WWF Crotone volunteer camps.

To complete your registration and unlock the payment receipt upload, click this link (valid for 24 hours):

${opts.verifyUrl}

If you didn't request this email, you can safely ignore it.

See you soon,
— WWF Crotone`;

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#ffffff;color:#262626">
  <div style="border-top:4px solid #007932;padding-top:20px;margin-bottom:20px">
    <h1 style="font-family:Arial,Helvetica,sans-serif;color:#007932;margin:0 0 8px 0;font-size:22px">WWF Crotone</h1>
    <p style="margin:0;color:#707070;font-size:13px">${isIt ? "Conferma iscrizione" : "Registration confirmation"}</p>
  </div>
  <h2 style="font-size:20px;margin:0 0 16px 0">${isIt ? "Ciao " : "Hi "}${first},</h2>
  <p>${isIt
    ? "grazie per esserti iscritto/a ai campi di volontariato WWF Crotone."
    : "thank you for signing up for the WWF Crotone volunteer camps."}</p>
  <p>${isIt
    ? "Per completare l'iscrizione e sbloccare il caricamento della ricevuta di pagamento, clicca il pulsante qui sotto."
    : "To complete your registration and unlock the payment receipt upload, click the button below."}</p>
  <p style="margin:28px 0">
    <a href="${safeUrl}" style="display:inline-block;background:#007932;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">
      ${isIt ? "Conferma iscrizione" : "Confirm registration"}
    </a>
  </p>
  <p style="font-size:14px;color:#707070">
    ${isIt ? "Oppure copia e incolla questo link nel browser:" : "Or copy and paste this link in your browser:"}<br/>
    <span style="word-break:break-all;color:#007932">${safeUrl}</span>
  </p>
  <p style="font-size:14px;color:#9b1c1c;margin-top:24px">
    <strong>${isIt ? "Questo link scade tra 24 ore" : "This link expires in 24 hours"}</strong>
  </p>
  <hr style="border:none;border-top:1px solid #cecece;margin:24px 0"/>
  <p style="font-size:12px;color:#707070">
    ${isIt
      ? "Se non hai richiesto tu questa email, puoi ignorarla in tutta sicurezza."
      : "If you didn't request this email, you can safely ignore it."}
  </p>
  <p style="font-size:12px;color:#707070;margin-top:24px">
    WWF Crotone — Sezione locale di WWF Italia ETS<br/>
    noreply@wwfcrotone.it
  </p>
</div>`;

  try {
    const t = getTransporter();
    if (!t) return { ok: false, error: "smtp-not-configured" };
    await t.sendMail({
      from: `"WWF Crotone" <noreply@wwfcrotone.it>`,
      to: opts.to,
      subject,
      text,
      html
    });
    return { ok: true };
  } catch (err) {
    console.error("registration-confirmation mail send failed:", err);
    return { ok: false, error: "send-failed" };
  }
}

/**
 * Notify the admin team that a volunteer uploaded a receipt.
 * Sent from info@wwfcrotone.it (the admin-facing mailbox) to
 * ADMIN_NOTIFY_EMAIL.
 */
export async function sendReceiptUploadedAdminNotification(iscrizione: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  turno: { number: number } | null;
  receiptUploads: { type: string; createdAt: Date }[];
}): Promise<{ ok: boolean; error?: string }> {
  const latest = iscrizione.receiptUploads[iscrizione.receiptUploads.length - 1];
  const typeLabel = latest?.type === "balance" ? "saldo" : "acconto";
  const typeLabelEn = latest?.type === "balance" ? "balance" : "deposit";
  const subject = `[WWF] Ricevuta ${typeLabel} caricata — ${iscrizione.firstName} ${iscrizione.lastName}`;
  const safeName = escapeHtml(`${iscrizione.firstName} ${iscrizione.lastName}`);
  const safeEmail = escapeHtml(iscrizione.email);
  const safeTurno = iscrizione.turno ? `Campo ${iscrizione.turno.number}` : "—";
  const isAdmin = true;
  void isAdmin;

  const text = `Il volontario ${iscrizione.firstName} ${iscrizione.lastName} (${iscrizione.email}) ha caricato la ricevuta del ${typeLabel} per ${safeTurno}.

ID Iscrizione: ${iscrizione.id}
Vai al pannello admin: /admin/iscrizioni/${iscrizione.id}`;

  const html = `<h2>Ricevuta ${typeLabel} caricata</h2>
<p><strong>${safeName}</strong> (${safeEmail}) ha caricato la ricevuta del <strong>${typeLabel}</strong> per <strong>${safeTurno}</strong>.</p>
<p><a href="/admin/iscrizioni/${iscrizione.id}">Apri nel pannello admin</a></p>`;

  try {
    const t = getTransporter();
    if (!t) return { ok: false, error: "smtp-not-configured" };
    await t.sendMail({
      from: `"WWF Crotone" <info@wwfcrotone.it>`,
      to: process.env.ADMIN_NOTIFY_EMAIL ?? SITE.email,
      subject,
      text,
      html
    });
    return { ok: true };
  } catch (err) {
    console.error("receipt-uploaded admin mail send failed:", err);
    return { ok: false, error: "send-failed" };
  }
}

/**
 * Notify the admin team of a status change in the volunteer lifecycle.
 * Covers the four lifecycle transitions:
 *   pending          → email_verified   (volunteer clicked magic link)
 *   email_verified   → receipt_uploaded (volunteer uploaded receipt)
 *   receipt_uploaded → confirmed        (admin approved)
 *   *                → cancelled        (admin or volunteer cancelled)
 */
export async function sendStatusChangeAdminNotification(
  iscrizione: { id: string; firstName: string; lastName: string; email: string; turno: { number: number } | null },
  oldStatus: string,
  newStatus: string
): Promise<{ ok: boolean; error?: string }> {
  const safeName = escapeHtml(`${iscrizione.firstName} ${iscrizione.lastName}`);
  const safeEmail = escapeHtml(iscrizione.email);
  const safeTurno = iscrizione.turno ? `Campo ${iscrizione.turno.number}` : "—";
  const subject = `[WWF] Iscrizione ${iscrizione.id.slice(-6)}: ${oldStatus} → ${newStatus}`;
  const text = `Stato dell'iscrizione di ${iscrizione.firstName} ${iscrizione.lastName} (${iscrizione.email}) per ${safeTurno} cambiato: ${oldStatus} → ${newStatus}.

ID: ${iscrizione.id}
Apri: /admin/iscrizioni/${iscrizione.id}`;

  const html = `<h2>Cambio stato iscrizione</h2>
<p><strong>${safeName}</strong> (${safeEmail}) — <strong>${safeTurno}</strong></p>
<p>Stato: <code>${oldStatus}</code> → <code>${newStatus}</code></p>
<p><a href="/admin/iscrizioni/${iscrizione.id}">Apri nel pannello admin</a></p>`;

  try {
    const t = getTransporter();
    if (!t) return { ok: false, error: "smtp-not-configured" };
    await t.sendMail({
      from: `"WWF Crotone" <info@wwfcrotone.it>`,
      to: process.env.ADMIN_NOTIFY_EMAIL ?? SITE.email,
      subject,
      text,
      html
    });
    return { ok: true };
  } catch (err) {
    console.error("status-change admin mail send failed:", err);
    return { ok: false, error: "send-failed" };
  }
}