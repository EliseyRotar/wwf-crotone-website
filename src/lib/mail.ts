import nodemailer from "nodemailer";
import { SITE } from "@/lib/site";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new Error("SMTP credentials not configured (SMTP_USER / SMTP_PASS)");
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
}) {
  try {
    const t = getTransporter();
    await t.sendMail({
      from: `"WWF Crotone" <${process.env.SMTP_USER}>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html
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

  return sendNotification({ to: data.email, subject, text, html });
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
  return sendNotification({
    to: opts.to.join(", "),
    subject: opts.subject,
    text,
    html
  });
}