/**
 * F17: SMS reminder stub.
 *
 * This module is the integration point for sending transactional SMS via
 * Twilio (or any other provider). It currently logs to the console and
 * never actually sends — real production wiring is intentionally left out
 * because it requires:
 *   - TWILIO_ACCOUNT_SID
 *   - TWILIO_AUTH_TOKEN
 *   - TWILIO_FROM_NUMBER
 *   - A separate EU/US data residency review for storing phone numbers
 *
 * To enable, swap `logOnly` for a fetch() to the Twilio REST API and add
 * the env vars above.
 */

export type SmsMessage = {
  to: string;          // E.164 phone number, e.g. "+393331234567"
  body: string;        // ≤ 1600 chars; Twilio splits into 153-char segments
  tag?: string;        // optional label for log filtering ("reminder", "waitlist")
};

export type SmsResult =
  | { ok: true; provider: "twilio-stub"; id: string }
  | { ok: false; error: string };

const logOnly = (msg: SmsMessage): SmsResult => {
  const id = `sms-stub-${Date.now()}`;
  console.log(`[sms:stub] tag=${msg.tag ?? "-"} id=${id}`);
  return { ok: true, provider: "twilio-stub", id };
};

export async function sendSms(msg: SmsMessage): Promise<SmsResult> {
  if (!msg.to) return { ok: false, error: "missing-recipient" };
  if (!msg.body) return { ok: false, error: "missing-body" };
  if (!/^\+\d{8,15}$/.test(msg.to)) {
    return { ok: false, error: "invalid-phone-format" };
  }
  return logOnly(msg);
}

export async function sendTurnReminderSms(opts: {
  to: string;
  firstName: string;
  turnNumber: number;
  turnStartISO: string;
  locale?: "it" | "en";
}): Promise<SmsResult> {
  const isIt = opts.locale !== "en";
  const when = new Date(opts.turnStartISO).toLocaleDateString(isIt ? "it-IT" : "en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
  const body = isIt
    ? `Ciao ${opts.firstName}, ti aspettiamo domenica ${when} per il Campo ${opts.turnNumber} WWF Crotone! Info: wwfcrotone.it`
    : `Hi ${opts.firstName}, see you on Sunday ${when} for WWF Crotone Camp ${opts.turnNumber}! Info: wwfcrotone.it`;
  return sendSms({ to: opts.to, body, tag: "turn-reminder" });
}
