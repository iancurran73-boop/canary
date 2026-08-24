import { getEmailConfig, getEmailTemplates, getBusinessConfig } from "./storage";
import nodemailer from "nodemailer";

// Sends via the mailbox's own SMTP server (e.g. Fasthosts Livemail), not a
// third-party API — configured entirely through env vars, never committed.
// SMTP_HOST/SMTP_PORT/SMTP_SECURE/SMTP_USER/SMTP_PASS must all be set on the
// server (Railway > Variables) for this to work.
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error("SMTP_HOST, SMTP_USER and SMTP_PASS must be set on the server");
  }
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE !== "false", // default true (port 465 SSL)
    auth: { user, pass },
  });
  return transporter;
}

async function sendViaSmtp(opts: { from: string; to: string; bcc?: string; subject: string; text: string }): Promise<void> {
  await getTransporter().sendMail({
    from: opts.from,
    to: opts.to,
    bcc: opts.bcc,
    subject: opts.subject,
    text: opts.text,
  });
}

// Checks the SMTP connection + login actually works, without sending
// anything — used by Admin > Emails > "Check setup".
export async function verifySmtpConnection(): Promise<void> {
  await getTransporter().verify();
}

function render(tmpl: string, vars: Record<string, string | number | undefined>): string {
  return tmpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? "").toString());
}

// Sent to the customer immediately when a booking request comes in — before
// it's confirmed or paid — so they're not left wondering if it went through
// while waiting on the owner (or a manual/slow payment) to confirm it.
export async function sendBookingReceivedEmail(booking: any): Promise<void> {
  const cfg = getEmailConfig();
  if (!cfg || !cfg.enabled || !cfg.fromEmail) return;
  if (!booking.email) return;
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
    depositStatus: `Awaiting deposit of £${booking.depositPaid}`,
  };
  const from = `${cfg.fromName ?? business.name ?? "The Singing Canary"} <${cfg.fromEmail}>`;
  try {
    await sendViaSmtp({
      from, to: booking.email,
      subject: render(templates.bookingReceived.subject, vars),
      text: render(templates.bookingReceived.body, vars),
    });
  } catch (e) { console.error("[email] booking received send failed", e); }
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
      await sendViaSmtp({
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
      await sendViaSmtp({
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
    await sendViaSmtp({
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
    await sendViaSmtp({
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
    await sendViaSmtp({
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
  const from = `${cfg.fromName ?? "Test"} <${cfg.fromEmail}>`;
  await sendViaSmtp({
    from,
    to: toOverride ?? cfg.ownerEmail ?? cfg.fromEmail,
    subject: "Test email from The Singing Canary admin",
    text: "If you can read this, your SMTP setup is working.",
  });
}
