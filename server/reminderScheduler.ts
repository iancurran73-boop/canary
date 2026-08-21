/**
 * server/reminderScheduler.ts
 * ─────────────────────────────
 * Polls for confirmed bookings whose appointment is coming up and sends a
 * one-off reminder email, gated on Admin > Emails > Reminders.
 *
 * There's no separate cron infrastructure here — the app server is a single
 * long-running Node process (Express + SQLite), so an in-process interval is
 * enough. Each sweep re-reads the config, so toggling reminders on/off or
 * changing the lead time takes effect on the very next poll, no restart
 * needed.
 */

import { storage, getEmailConfig } from "./storage";
import { sendReminderEmail } from "./email";
import type { Booking } from "@shared/schema";

const POLL_MS = 15 * 60 * 1000; // 15 minutes

function appointmentDate(b: Booking): Date {
  const [h, m] = b.startTime.split(":").map(Number);
  const d = new Date(`${b.date}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
}

export async function runReminderSweep(): Promise<void> {
  const cfg = getEmailConfig();
  if (!cfg.enabled || !cfg.remindersEnabled) return;
  const hoursBefore = cfg.reminderHoursBefore > 0 ? cfg.reminderHoursBefore : 24;

  const candidates = await storage.listBookingsAwaitingReminder();
  const now = Date.now();

  for (const b of candidates) {
    const hoursUntil = (appointmentDate(b).getTime() - now) / 3_600_000;

    if (hoursUntil > hoursBefore) continue; // not due yet, check again next sweep

    if (hoursUntil <= 0) {
      // Appointment already happened (e.g. the server was down over the
      // reminder window) — nothing useful to send, just stop tracking it.
      await storage.markBookingReminderSent(b.id);
      continue;
    }

    const service = await storage.getService(b.serviceId);
    const sent = await sendReminderEmail({
      email: b.customerEmail,
      customerName: b.customerName,
      dogName: b.dogName,
      date: b.date,
      time: b.startTime,
      serviceName: service?.name ?? "",
      balanceDue: b.balanceDue.toFixed(2),
    });
    if (sent) await storage.markBookingReminderSent(b.id);
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startReminderScheduler(): void {
  if (timer) return; // idempotent — don't stack intervals across hot reloads
  const tick = () => { runReminderSweep().catch((e) => console.error("[reminders] sweep failed", e)); };
  tick();
  timer = setInterval(tick, POLL_MS);
  console.log("[reminders] scheduler started, polling every 15 minutes");
}
