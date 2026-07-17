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

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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