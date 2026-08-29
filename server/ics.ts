// Read-only iCalendar (RFC 5545) feed generation — lets the owner subscribe
// to their bookings from any calendar app (Apple Calendar, Google Calendar,
// Outlook) via a single URL, with no OAuth or per-provider setup. Access
// control is just an unguessable token in the URL; there's no login here.
import type { Booking } from "@shared/schema";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

// "YYYY-MM-DD" + "HH:MM" -> "YYYYMMDDTHHMMSS" (floating local time, paired
// with a TZID param by the caller — not UTC).
function toIcsLocal(date: string, time: string): string {
  const [y, m, d] = date.split("-");
  const [h, min] = time.split(":");
  return `${y}${m}${d}T${pad(Number(h))}${pad(Number(min))}00`;
}

// A slot like 23:00-03:00 ends the calendar day after it starts — this
// mirrors the +1440 "crosses midnight" handling in routes.ts's timesOverlap.
function endDateFor(date: string, startTime: string, endTime: string): string {
  if (endTime > startTime) return date;
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function utcStamp(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

// Long lines must be folded at 75 octets per RFC 5545, and reserved
// characters escaped, or strict parsers (Apple's included) will choke.
function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return parts.join("\r\n");
}

export function buildIcsFeed(bookings: Booking[], calendarName: string): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//" + calendarName.replace(/[^A-Za-z0-9 ]/g, "") + "//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)} bookings`,
    "X-WR-TIMEZONE:Europe/London",
    // Suggest a refresh interval to clients that honour it (Apple's own
    // subscription polling ignores this and uses its own schedule anyway).
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];

  for (const b of bookings) {
    const summary = `${b.eventType || "Booking"} — ${b.customerName}`;
    const descriptionParts = [
      `Party size: ${b.partySize}`,
      b.customerPhone ? `Phone: ${b.customerPhone}` : null,
      b.notes ? `Notes: ${b.notes}` : null,
    ].filter(Boolean) as string[];

    lines.push(
      "BEGIN:VEVENT",
      `UID:booking-${b.id}@bookings`,
      `DTSTAMP:${utcStamp(b.createdAt)}`,
      `DTSTART;TZID=Europe/London:${toIcsLocal(b.date, b.startTime)}`,
      `DTEND;TZID=Europe/London:${toIcsLocal(endDateFor(b.date, b.startTime, b.endTime), b.endTime)}`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${descriptionParts.map(escapeText).join("\\n")}`,
      `STATUS:${b.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
