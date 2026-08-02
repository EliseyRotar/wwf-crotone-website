import nodemailer from "nodemailer";
import { SITE } from "@/config/site";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    console.warn("SMTP not configured — emails will be skipped");
    return null;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? "true") === "true",
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
      from: `"WWF Crotone" <${process.env.SMTP_USER}>`,
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
  turno: string;
  isMinor: boolean;
  locale: string;
}) {
  const fn = escapeHtml(data.firstName);
  const ln = escapeHtml(data.lastName);
  const em = escapeHtml(data.email);
  const ph = escapeHtml(data.phone);
  const turn = escapeHtml(data.turno);
  const subject = `Nuova iscrizione — ${data.firstName} ${data.lastName} — ${data.turno}`.replace(/[\r\n]/g, " ");
  const text = `
Nuova iscrizione al campo di volontariato WWF Crotone.

Nome: ${data.firstName} ${data.lastName}
Email: ${data.email}
Telefono: ${data.phone}
Turno: ${data.turno}
Minorenne: ${data.isMinor ? "Sì" : "No"}
Lingua: ${data.locale}

Vedi il pannello admin per i dettagli completi.
`.trim();
  const html = `
<h2>Nuova iscrizione al campo di volontariato WWF Crotone</h2>
<table style="border-collapse:collapse">
  <tr><th style="text-align:left;padding:4px 12px;border:1px solid #cecece">Nome</th><td style="padding:4px 12px;border:1px solid #cecece">${fn} ${ln}</td></tr>
  <tr><th style="text-align:left;padding:4px 12px;border:1px solid #cecece">Email</th><td style="padding:4px 12px;border:1px solid #cecece">${em}</td></tr>
  <tr><th style="text-align:left;padding:4px 12px;border:1px solid #cecece">Telefono</th><td style="padding:4px 12px;border:1px solid #cecece">${ph}</td></tr>
  <tr><th style="text-align:left;padding:4px 12px;border:1px solid #cecece">Turno</th><td style="padding:4px 12px;border:1px solid #cecece">${turn}</td></tr>
  <tr><th style="text-align:left;padding:4px 12px;border:1px solid #cecece">Minorenne</th><td style="padding:4px 12px;border:1px solid #cecece">${data.isMinor ? "Sì" : "No"}</td></tr>
</table>
<p style="margin-top:16px;color:#707070">Vedi il pannello admin per i dettagli completi.</p>
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
        from: `"WWF Crotone" <${process.env.SMTP_USER}>`,
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
      from: `"WWF Crotone" <${process.env.SMTP_USER}>`,
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