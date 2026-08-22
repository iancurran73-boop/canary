import { getEmailConfig, getEmailTemplates, getBusinessConfig } from "./storage";

// Resend's HTTP API, not raw SMTP — see sophiespamperedpaws for why (Railway
// blocks outbound SMTP entirely; an HTTPS API call on port 443 sidesteps it).
const RESEND_API_URL = "https://api.resend.com/emails";

async function sendViaResend(opts: { from: string; to: string; bcc?: string; subject: string; text: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set on the server");
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opts.from,
      to: [opts.to],
      ...(opts.bcc ? { bcc: [opts.bcc] } : {}),
      subject: opts.subject,
      text: opts.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend error ${res.status}: ${body.slice(0, 300)}`);
  }
}

function render(tmpl: string, vars: Record<string, string | number | undefined>): string {
  return tmpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? "").toString());
}

export async function sendBookingEmails(booking: any) {
  const cfg = getEmailConfig();
  if (!cfg || !cfg.enabled || !cfg.fromEmail) return;
  const templates = getEmailTemplates();
  const business = getBusinessConfig() ?? {};
  const vars = {
    business: business.name ?? "The Singing Canary",
    ownerName: business.ownerName ?? "The team",
    customer: booking.customerName ?? "",
    phone: booking.phone ?? "",
    email: booking.email ?? "",
    date: booking.date ?? "",
    time: booking.time ?? "",
    eventType: booking.eventType ?? "",
    partySize: booking.partySize ?? "",
    deposit: booking.depositPaid ?? "0.00",
    notes: booking.notes ?? "",
    shoutOuts: booking.shoutOuts ?? "",
  };
  const from = `${cfg.fromName ?? business.name ?? "The Singing Canary"} <${cfg.fromEmail}>`;

  // To customer
  if (booking.email) {
    try {
      await sendViaResend({
        from, to: booking.email,
        bcc: cfg.bccOwner && cfg.ownerEmail ? cfg.ownerEmail : undefined,
        subject: render(templates.customerConfirm.subject, vars),
        text: render(templates.customerConfirm.body, vars),
      });
    } catch (e) { console.error("[email] customer send failed", e); }
  }

  // To owner
  if (cfg.ownerEmail) {
    try {
      await sendViaResend({
        from, to: cfg.ownerEmail,
        subject: render(templates.ownerAlert.subject, vars),
        text: render(templates.ownerAlert.body, vars),
      });
    } catch (e) { console.error("[email] owner send failed", e); }
  }
}

// Fired the moment any booking is created, to the owner only — distinct from
// the ownerAlert above, which only fires once a booking is actually
// confirmed. Without this, a pending booking sits unconfirmed with nobody
// told it exists until the owner happens to check the admin panel.
export async function sendNewBookingAlert(booking: any): Promise<void> {
  const cfg = getEmailConfig();
  if (!cfg || !cfg.enabled || !cfg.fromEmail || !cfg.ownerEmail) return;
  const templates = getEmailTemplates();
  const business = getBusinessConfig() ?? {};
  const vars = {
    business: business.name ?? "The Singing Canary",
    ownerName: business.ownerName ?? "The team",
    customer: booking.customerName ?? "",
    phone: booking.phone ?? "",
    email: booking.email ?? "",
    date: booking.date ?? "",
    time: booking.time ?? "",
    eventType: booking.eventType ?? "",
    partySize: booking.partySize ?? "",
    notes: booking.notes ?? "",
    shoutOuts: booking.shoutOuts ?? "",
    depositStatus: `Awaiting deposit of £${booking.depositPaid}`,
  };
  const from = `${cfg.fromName ?? business.name ?? "The Singing Canary"} <${cfg.fromEmail}>`;
  try {
    await sendViaResend({
      from, to: cfg.ownerEmail,
      subject: render(templates.newBookingRequest.subject, vars),
      text: render(templates.newBookingRequest.body, vars),
    });
  } catch (e) { console.error("[email] new booking alert failed", e); }
}

// Booking reminder, sent to the customer only. Returns whether it was
// actually sent, so the reminder scheduler only marks a booking as reminded
// once the send genuinely succeeds — a transient failure gets retried on
// the next sweep instead of silently being treated as delivered.
export async function sendReminderEmail(booking: any): Promise<boolean> {
  const cfg = getEmailConfig();
  if (!cfg || !cfg.enabled || !cfg.remindersEnabled || !cfg.fromEmail) return false;
  if (!booking.email) return false;
  const templates = getEmailTemplates();
  const business = getBusinessConfig() ?? {};
  const vars = {
    business: business.name ?? "The Singing Canary",
    ownerName: business.ownerName ?? "The team",
    customer: booking.customerName ?? "",
    date: booking.date ?? "",
    time: booking.time ?? "",
    partySize: booking.partySize ?? "",
  };
  const from = `${cfg.fromName ?? business.name ?? "The Singing Canary"} <${cfg.fromEmail}>`;
  try {
    await sendViaResend({
      from, to: booking.email,
      subject: render(templates.appointmentReminder.subject, vars),
      text: render(templates.appointmentReminder.body, vars),
    });
    return true;
  } catch (e) {
    console.error("[email] reminder send failed", e);
    return false;
  }
}

// Cancellation notice, sent to the customer only, when the owner cancels
// a booking from the admin panel.
export async function sendCancellationEmail(booking: any): Promise<void> {
  const cfg = getEmailConfig();
  if (!cfg || !cfg.enabled || !cfg.fromEmail) return;
  if (!booking.email) return;
  const templates = getEmailTemplates();
  const business = getBusinessConfig() ?? {};
  const vars = {
    business: business.name ?? "The Singing Canary",
    ownerName: business.ownerName ?? "The team",
    customer: booking.customerName ?? "",
    date: booking.date ?? "",
    time: booking.time ?? "",
    eventType: booking.eventType ?? "",
  };
  const from = `${cfg.fromName ?? business.name ?? "The Singing Canary"} <${cfg.fromEmail}>`;
  try {
    await sendViaResend({
      from, to: booking.email,
      subject: render(templates.cancellation.subject, vars),
      text: render(templates.cancellation.body, vars),
    });
  } catch (e) { console.error("[email] cancellation send failed", e); }
}

export async function sendTestEmail(toOverride?: string) {
  const cfg = getEmailConfig();
  // Real bookings (sendBookingEmails, sendNewBookingAlert) both bail out
  // silently if this is off — check it here too, first, so "Send test
  // email" can't succeed while real booking emails are quietly doing
  // nothing because of it.
  if (!cfg || !cfg.enabled) throw new Error('"Send booking emails" is switched off in Admin > Emails — turn it on to send anything, including this test.');
  if (!cfg.fromEmail) throw new Error("Email not configured — set a From email in Admin > Emails");
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set on the server");
  const from = `${cfg.fromName ?? "Test"} <${cfg.fromEmail}>`;
  await sendViaResend({
    from,
    to: toOverride ?? cfg.ownerEmail ?? cfg.fromEmail,
    subject: "Test email from The Singing Canary admin",
    text: "If you can read this, your Resend setup is working.",
  });
}
