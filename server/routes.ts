import type { Express, Request, Response } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import {
  storage,
  getEmailConfig,
  setEmailConfig,
  getEmailTemplates,
  setEmailTemplates,
  type EmailConfig,
  type EmailTemplates,
} from "./storage";
import { sendBookingEmails, sendNewBookingAlert, sendCancellationEmail, sendTestEmail, verifySmtpConnection } from "./email";
import {
  insertBlockedDateSchema,
  insertSettingsSchema,
  insertWorkingHoursSchema,
  insertBarHoursSchema,
  insertGalleryItemSchema,
  insertReviewSchema,
  insertEventSchema,
} from "@shared/schema";
import type { WorkingHours, BlockedDate } from "@shared/schema";
import { PAGE_LAYOUT_IDS } from "@shared/page-layouts";
import { requireAdminAuth, issueSessionCookie, clearSessionCookie, checkLoginRateLimit, verifyPasscode } from "./adminAuth";
import { z } from "zod";
import tenantConfig from "../tenant.config";

const HHMM = /^\d{2}:\d{2}$/;
const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
// Whether a named slot (e.g. "23:00"-"03:00") is still bookable on the given
// calendar day: far enough from now to satisfy min notice, and not covered
// by a blocked-date range. Handles slots that cross midnight (end <= start).
function slotIsBookable(
  slot: WorkingHours,
  dayMidnight: Date,
  now: Date,
  minNoticeMs: number,
  blocksThatDay: BlockedDate[]
): boolean {
  const slotStart = new Date(dayMidnight);
  slotStart.setMinutes(toMinutes(slot.startTime));
  if (slotStart.getTime() - now.getTime() < minNoticeMs) return false;

  const startMin = toMinutes(slot.startTime);
  let endMin = toMinutes(slot.endTime);
  if (endMin <= startMin) endMin += 1440; // crosses midnight

  return !blocksThatDay.some((bd) => {
    if (!bd.startTime || !bd.endTime) return true; // whole day blocked
    return startMin < toMinutes(bd.endTime) && endMin > toMinutes(bd.startTime);
  });
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Map a stored booking row into the shape sendBookingEmails expects.
  const emailForBooking = async (booking: Record<string, any>) => ({
    customerName: booking.customerName,
    email: booking.customerEmail,
    phone: booking.customerPhone,
    date: booking.date,
    time: booking.startTime,
    eventType: booking.eventType,
    partySize: booking.partySize,
    depositPaid: typeof booking.depositAmount === "number" ? booking.depositAmount.toFixed(2) : booking.depositAmount,
    notes: booking.notes,
    shoutOuts: booking.shoutOuts,
  });

  // ========= PUBLIC (widget) =========

  // Venue meta (used by the widget) — session length and deposit are venue-wide,
  // there's no per-service concept, just the one room.
  app.get("/api/public/studio", async (_req, res) => {
    const s = await storage.getSettings();
    res.json({
      studioName: s.studioName,
      acceptingBookings: s.acceptingBookings,
      minNoticeHours: s.minNoticeHours,
      maxAdvanceDays: s.maxAdvanceDays,
      sessionDurationMinutes: s.sessionDurationMinutes,
      depositAmount: s.depositAmount,
    });
  });

  // Available session start-times on a given date. Each day-of-week has a
  // fixed set of named slots (e.g. weekends: 13:00-17:00, 18:00-22:00,
  // 23:00-03:00) rather than a continuous open window — the customer picks
  // one, not an arbitrary time.
  app.get("/api/public/availability", async (req, res) => {
    const date = String(req.query.date || "");
    if (!date) return res.status(400).json({ error: "date required" });

    const settings = await storage.getSettings();
    if (!settings.acceptingBookings) return res.json({ slots: [] });

    const target = new Date(date + "T00:00:00");
    const now = new Date();
    const minNoticeMs = settings.minNoticeHours * 3600_000;
    const maxAdvanceMs = settings.maxAdvanceDays * 86400_000;
    if (target.getTime() - now.getTime() > maxAdvanceMs) return res.json({ slots: [] });

    const dow = target.getDay();
    const daySlots = (await storage.listWorkingHours()).filter((w) => w.dayOfWeek === dow && w.enabled);
    if (daySlots.length === 0) return res.json({ slots: [] });

    // Existing bookings that day — the room is exclusive for the whole day,
    // not just the booked session, so any pending/confirmed booking at all
    // takes the entire day off the table.
    const dayBookings = (await storage.listBookings(date, date)).filter(
      (b) => b.status === "pending" || b.status === "confirmed"
    );
    if (dayBookings.length > 0) return res.json({ slots: [], durationMinutes: settings.sessionDurationMinutes });

    const blocks = await storage.listBlockedDates(date, date);

    const slots = daySlots
      .filter((w) => slotIsBookable(w, target, now, minNoticeMs, blocks))
      .map((w) => w.startTime)
      .sort();

    res.json({ slots, durationMinutes: settings.sessionDurationMinutes });
  });

  // Cheap Y/N availability for a date range, so the date picker can grey out
  // fully-booked days upfront instead of making people tap through each one.
  app.get("/api/public/availability-range", async (req, res) => {
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    if (!from || !to) return res.status(400).json({ error: "from and to required" });

    const settings = await storage.getSettings();
    const wh = await storage.listWorkingHours();
    const slotsByDay = new Map<number, WorkingHours[]>();
    for (const w of wh) {
      if (!w.enabled) continue;
      const list = slotsByDay.get(w.dayOfWeek) ?? [];
      list.push(w);
      slotsByDay.set(w.dayOfWeek, list);
    }

    const dayBookings = (await storage.listBookings(from, to)).filter(
      (b) => b.status === "pending" || b.status === "confirmed"
    );
    const bookedDates = new Set(dayBookings.map((b) => b.date));
    const blocks = await storage.listBlockedDates(from, to);
    const blocksByDate = new Map<string, BlockedDate[]>();
    for (const bd of blocks) {
      const list = blocksByDate.get(bd.date) ?? [];
      list.push(bd);
      blocksByDate.set(bd.date, list);
    }

    const now = new Date();
    const minNoticeMs = settings.minNoticeHours * 3600_000;

    const unavailable: string[] = [];
    if (settings.acceptingBookings) {
      const cursor = new Date(from + "T00:00:00");
      const end = new Date(to + "T00:00:00");
      while (cursor.getTime() <= end.getTime()) {
        const dateStr = cursor.toISOString().slice(0, 10);
        const daySlots = slotsByDay.get(cursor.getDay()) ?? [];
        const dateBlocks = blocksByDate.get(dateStr) ?? [];
        const ok = daySlots.length > 0 && !bookedDates.has(dateStr) &&
          daySlots.some((w) => slotIsBookable(w, cursor, now, minNoticeMs, dateBlocks));
        if (!ok) unavailable.push(dateStr);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    res.json({ unavailable });
  });

  // Create a booking (status=pending) — a flat deposit secures it, refunded
  // as a bar tab on the night.
  app.post("/api/public/bookings", async (req, res) => {
    const bodySchema = z.object({
      customerName: z.string().min(1),
      customerEmail: z.string().email(),
      customerPhone: z.string().min(5),
      eventType: z.string().min(1, "Let us know what the occasion is"),
      partySize: z.number().int().min(1).max(200),
      notes: z.string().optional().default(""),
      shoutOuts: z.string().optional().default(""),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      startTime: z.string().regex(HHMM),
    });
    const parse = bodySchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    const data = parse.data;

    const settings = await storage.getSettings();
    if (!settings.acceptingBookings) return res.status(400).json({ error: "Not currently taking bookings" });

    // The requested start must match one of that day-of-week's defined
    // slots — its own endTime defines the session length, not a fixed
    // global duration (slots can differ, e.g. the 23:00-03:00 late slot).
    const dow = new Date(data.date + "T00:00:00").getDay();
    const matchingSlot = (await storage.listWorkingHours()).find(
      (w) => w.dayOfWeek === dow && w.enabled && w.startTime === data.startTime
    );
    if (!matchingSlot) return res.status(400).json({ error: "That start time is no longer available" });
    const endTime = matchingSlot.endTime;

    // Final check (race protection) — the room is exclusive for the whole
    // day, so any existing pending/confirmed booking that date blocks this one.
    const sameDay = (await storage.listBookings(data.date, data.date)).filter(
      (b) => b.status === "pending" || b.status === "confirmed"
    );
    if (sameDay.length > 0) return res.status(409).json({ error: "That day just got booked — please pick another." });

    const booking = await storage.createBooking({
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      eventType: data.eventType,
      partySize: data.partySize,
      notes: data.notes,
      shoutOuts: data.shoutOuts,
      date: data.date,
      startTime: data.startTime,
      endTime,
      depositAmount: settings.depositAmount,
      status: "pending",
      paymentRef: "",
      createdAt: Date.now(),
      sumupCheckoutId: "",
      reminderSentAt: null,
    });

    // Tell the owner a new request has come in right away — this is
    // separate from the "booking confirmed" alert below, which only fires
    // once the booking is actually confirmed (payment or manual review).
    emailForBooking(booking).then((b) => sendNewBookingAlert(b)).catch((e) => console.error("[email]", e));

    res.json({
      bookingId: booking.id,
      depositAmount: booking.depositAmount,
      status: booking.status,
    });
  });

  // Mock payment confirmation (Stripe webhook stand-in)
  app.post("/api/public/bookings/:id/confirm-payment", async (req, res) => {
    const id = Number(req.params.id);
    const ref = (req.body?.paymentRef as string) || `mock_${Date.now()}`;
    const updated = await storage.updateBookingStatus(id, "confirmed", ref);
    if (!updated) return res.status(404).json({ error: "Not found" });
    emailForBooking(updated).then((b) => sendBookingEmails(b)).catch((e) => console.error("[email]", e));
    res.json(updated);
  });

  app.get("/api/public/bookings/:id", async (req, res) => {
    const id = Number(req.params.id);
    const b = await storage.getBooking(id);
    if (!b) return res.status(404).json({ error: "Not found" });
    res.json(b);
  });

  // ========= ADMIN AUTH =========
  // Registered before the blanket gate below so login/logout stay reachable
  // without a session. Everything else under /api/admin requires one.

  app.post("/api/admin/login", (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkLoginRateLimit(ip)) {
      return res.status(429).json({ error: "Too many attempts. Try again later." });
    }
    const passcode = String(req.body?.passcode || "");
    if (!verifyPasscode(passcode)) {
      return res.status(401).json({ error: "Incorrect passcode" });
    }
    issueSessionCookie(res);
    res.json({ ok: true });
  });

  app.post("/api/admin/logout", (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.use("/api/admin", requireAdminAuth);

  app.get("/api/admin/session", (_req, res) => {
    // Reaching this handler already means requireAdminAuth passed.
    res.json({ ok: true });
  });

  // ========= ADMIN =========

  app.get("/api/admin/working-hours", async (_req, res) => {
    res.json(await storage.listWorkingHours());
  });
  app.put("/api/admin/working-hours", async (req, res) => {
    const arr = z.array(insertWorkingHoursSchema).safeParse(req.body);
    if (!arr.success) return res.status(400).json({ error: arr.error.flatten() });
    res.json(await storage.upsertWorkingHours(arr.data));
  });

  app.get("/api/admin/bar-hours", async (_req, res) => {
    res.json(await storage.listBarHours());
  });
  app.put("/api/admin/bar-hours", async (req, res) => {
    const arr = z.array(insertBarHoursSchema).safeParse(req.body);
    if (!arr.success) return res.status(400).json({ error: arr.error.flatten() });
    res.json(await storage.upsertBarHours(arr.data));
  });

  app.get("/api/admin/blocked-dates", async (req, res) => {
    res.json(await storage.listBlockedDates(req.query.from as string | undefined, req.query.to as string | undefined));
  });
  app.post("/api/admin/blocked-dates", async (req, res) => {
    const parse = insertBlockedDateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    res.json(await storage.createBlockedDate(parse.data));
  });
  app.delete("/api/admin/blocked-dates/:id", async (req, res) => {
    res.json({ ok: await storage.deleteBlockedDate(Number(req.params.id)) });
  });

  app.get("/api/admin/bookings", async (req, res) => {
    const list = await storage.listBookings(req.query.from as string | undefined, req.query.to as string | undefined);
    const enriched = await Promise.all(list.map(async (b) => {
      const hist = await storage.getCustomerHistory(b.customerEmail, b.customerPhone, b.id);
      const returningCustomer = hist.visits > 0 ? {
        visits: hist.visits,
        lastVisitDate: hist.lastVisitDate,
        lastEventType: hist.lastEventType,
      } : null;
      return { ...b, returningCustomer };
    }));
    res.json(enriched);
  });

  // Manually add a booking (phone/walk-in enquiries etc). Unlike the public
  // endpoint, this isn't subject to min-notice/max-advance windows — the
  // admin can book any date. Still must match a defined slot for that
  // day-of-week (so endTime/duration stay consistent with everything else),
  // and still respects the one-booking-per-day rule.
  app.post("/api/admin/bookings", async (req, res) => {
    const bodySchema = z.object({
      customerName: z.string().min(1),
      customerEmail: z.string().optional().default(""),
      customerPhone: z.string().optional().default(""),
      eventType: z.string().optional().default(""),
      partySize: z.number().int().min(1).max(200),
      notes: z.string().optional().default(""),
      shoutOuts: z.string().optional().default(""),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      startTime: z.string().regex(HHMM),
      status: z.enum(["pending", "confirmed"]).optional().default("confirmed"),
      depositAmount: z.number().min(0).optional(),
    });
    const parse = bodySchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    const data = parse.data;

    const dow = new Date(data.date + "T00:00:00").getDay();
    const matchingSlot = (await storage.listWorkingHours()).find(
      (w) => w.dayOfWeek === dow && w.enabled && w.startTime === data.startTime
    );
    if (!matchingSlot) {
      return res.status(400).json({ error: "That start time isn't a defined slot for this day — add it in Admin > Hours first." });
    }

    const sameDay = (await storage.listBookings(data.date, data.date)).filter(
      (b) => b.status === "pending" || b.status === "confirmed"
    );
    if (sameDay.length > 0) return res.status(409).json({ error: "That day already has a booking." });

    const settings = await storage.getSettings();
    const booking = await storage.createBooking({
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      eventType: data.eventType,
      partySize: data.partySize,
      notes: data.notes,
      shoutOuts: data.shoutOuts,
      date: data.date,
      startTime: data.startTime,
      endTime: matchingSlot.endTime,
      depositAmount: data.depositAmount ?? settings.depositAmount,
      status: data.status,
      paymentRef: "",
      createdAt: Date.now(),
      sumupCheckoutId: "",
      reminderSentAt: null,
    });

    if (data.status === "confirmed" && booking.customerEmail) {
      emailForBooking(booking).then((b) => sendBookingEmails(b)).catch((e) => console.error("[email]", e));
    }

    res.json(booking);
  });

  app.post("/api/admin/bookings/:id/cancel", async (req, res) => {
    const cancelled = await storage.cancelBooking(Number(req.params.id));
    if (!cancelled) return res.status(404).json({ error: "Not found" });
    emailForBooking(cancelled).then((b) => sendCancellationEmail(b)).catch((e) => console.error("[email]", e));
    res.json(cancelled);
  });
  app.post("/api/admin/bookings/:id/complete", async (req, res) => {
    const updated = await storage.updateBookingStatus(Number(req.params.id), "completed");
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });
  app.post("/api/admin/bookings/:id/confirm", async (req, res) => {
    const updated = await storage.updateBookingStatus(Number(req.params.id), "confirmed");
    if (!updated) return res.status(404).json({ error: "Not found" });
    emailForBooking(updated).then((b) => sendBookingEmails(b)).catch((e) => console.error("[email]", e));
    res.json(updated);
  });

  app.get("/api/admin/settings", async (_req, res) => {
    res.json(await storage.getSettings());
  });
  app.patch("/api/admin/settings", async (req, res) => {
    const parse = insertSettingsSchema.partial().safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    res.json(await storage.updateSettings(parse.data));
  });

  // ========= PUBLIC CONTENT / GALLERY / WORKING HOURS / REVIEWS =========

  app.get("/api/public/content", async (_req, res) => {
    res.json(await storage.listContent());
  });

  app.get("/api/public/gallery", async (_req, res) => {
    res.json(await storage.listGalleryItems(true));
  });

  app.get("/api/public/working-hours", async (_req, res) => {
    res.json(await storage.listWorkingHours());
  });

  app.get("/api/public/bar-hours", async (_req, res) => {
    res.json(await storage.listBarHours());
  });

  app.get("/api/public/reviews", async (_req, res) => {
    res.json(await storage.listReviews(true));
  });

  // Upcoming, active events only — past events drop off automatically.
  app.get("/api/public/events", async (_req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    res.json(await storage.listEvents(true, today));
  });

  // Nav-visible pages, in display order. Drives the site header/footer nav.
  app.get("/api/public/pages", async (_req, res) => {
    res.json(await storage.listPages(true));
  });
  // A single custom page's metadata, looked up by slug — used by the
  // generic /p/:slug renderer to know which layout to render. Not
  // gated on `visible`: hiding a page from the nav doesn't 404 its
  // direct URL, it just removes the nav link.
  app.get("/api/public/pages/:slug", async (req, res) => {
    const page = await storage.getPageBySlug(req.params.slug);
    if (!page) return res.status(404).json({ error: "Not found" });
    res.json(page);
  });

  // ========= ADMIN CONTENT =========

  app.get("/api/admin/content", async (_req, res) => {
    res.json(await storage.listContent());
  });
  app.put("/api/admin/content/:key", async (req, res) => {
    const key = req.params.key;
    const value = req.body?.value;
    if (typeof value !== "string") return res.status(400).json({ error: "value (string) required" });
    res.json(await storage.setContent(key, value));
  });
  app.delete("/api/admin/content/:key", async (req, res) => {
    res.json({ ok: await storage.deleteContent(req.params.key) });
  });

  // ========= ADMIN GALLERY =========

  app.get("/api/admin/gallery", async (_req, res) => {
    res.json(await storage.listGalleryItems(false));
  });
  app.post("/api/admin/gallery", async (req, res) => {
    const parse = insertGalleryItemSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    res.json(await storage.createGalleryItem(parse.data));
  });
  app.patch("/api/admin/gallery/:id", async (req, res) => {
    const id = Number(req.params.id);
    const parse = insertGalleryItemSchema.partial().safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    const updated = await storage.updateGalleryItem(id, parse.data);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });
  app.delete("/api/admin/gallery/:id", async (req, res) => {
    res.json({ ok: await storage.deleteGalleryItem(Number(req.params.id)) });
  });

  // ========= ADMIN REVIEWS =========

  app.get("/api/admin/reviews", async (_req, res) => {
    res.json(await storage.listReviews(false));
  });
  app.post("/api/admin/reviews", async (req, res) => {
    const parse = insertReviewSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    res.json(await storage.createReview(parse.data));
  });
  app.patch("/api/admin/reviews/:id", async (req, res) => {
    const id = Number(req.params.id);
    const parse = insertReviewSchema.partial().safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    const updated = await storage.updateReview(id, parse.data);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });
  app.delete("/api/admin/reviews/:id", async (req, res) => {
    res.json({ ok: await storage.deleteReview(Number(req.params.id)) });
  });

  // ========= ADMIN EVENTS =========

  app.get("/api/admin/events", async (_req, res) => {
    res.json(await storage.listEvents(false));
  });
  app.post("/api/admin/events", async (req, res) => {
    const parse = insertEventSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    res.json(await storage.createEvent(parse.data));
  });
  app.patch("/api/admin/events/:id", async (req, res) => {
    const id = Number(req.params.id);
    const parse = insertEventSchema.partial().safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    const updated = await storage.updateEvent(id, parse.data);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });
  app.delete("/api/admin/events/:id", async (req, res) => {
    res.json({ ok: await storage.deleteEvent(Number(req.params.id)) });
  });

  // ========= ADMIN PAGES =========
  // Core pages (Home, Gallery, About, Contact, How It Works) are
  // seeded once and only their nav placement (navLabel/sortOrder/visible) can
  // change here — their content is edited in the existing Content tab, and
  // they can't be deleted since other pages link to their fixed URLs.
  // Custom pages are fully owned by this API: created with a layout that
  // never changes afterward, content lives in the `content` table under
  // "page.<slug>.*" keys, and they can be freely reordered, hidden or deleted.

  app.get("/api/admin/pages", async (_req, res) => {
    res.json(await storage.listPages(false));
  });

  app.post("/api/admin/pages", async (req, res) => {
    const bodySchema = z.object({
      navLabel: z.string().trim().min(1).max(60),
      slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only"),
      layout: z.enum(PAGE_LAYOUT_IDS as [string, ...string[]]),
    });
    const parse = bodySchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

    const existing = await storage.getPageBySlug(parse.data.slug);
    if (existing) return res.status(409).json({ error: "A page with that slug already exists" });

    const all = await storage.listPages(false);
    const nextSort = all.reduce((max, p) => Math.max(max, p.sortOrder), -1) + 1;

    const page = await storage.createPage({
      navLabel: parse.data.navLabel,
      slug: parse.data.slug,
      path: `/p/${parse.data.slug}`,
      kind: "custom",
      layout: parse.data.layout,
      sortOrder: nextSort,
      visible: true,
    });
    res.json(page);
  });

  app.patch("/api/admin/pages/:id", async (req, res) => {
    const id = Number(req.params.id);
    const page = await storage.getPage(id);
    if (!page) return res.status(404).json({ error: "Not found" });

    const bodySchema = z.object({
      navLabel: z.string().trim().min(1).max(60).optional(),
      visible: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
      layout: z.enum(PAGE_LAYOUT_IDS as [string, ...string[]]).optional(),
    });
    const parse = bodySchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

    if (parse.data.layout !== undefined && page.kind !== "custom") {
      return res.status(400).json({ error: "Only custom pages can change layout." });
    }

    const updated = await storage.updatePage(id, parse.data);
    res.json(updated);
  });

  app.delete("/api/admin/pages/:id", async (req, res) => {
    const id = Number(req.params.id);
    const page = await storage.getPage(id);
    if (!page) return res.status(404).json({ error: "Not found" });
    if (page.kind === "core") {
      return res.status(400).json({ error: "Core pages can't be deleted — hide them from the nav instead." });
    }
    res.json({ ok: await storage.deletePage(id) });
  });

  // ========= PAYMENTS CONFIG (admin) =========
  // Stored in content k/v table.
  // Keys:
  //   payments_mode         : "mvp" | "sumup"
  //   sumup_api_key         : SumUp API key (sup_sk_...)
  //   sumup_merchant_code   : Merchant code from SumUp Dashboard

  const readPaymentsConfig = async () => {
    const mode = (await storage.getContent("payments_mode"))?.value || "mvp";
    const apiKey = (await storage.getContent("sumup_api_key"))?.value || "";
    const merchantCode = (await storage.getContent("sumup_merchant_code"))?.value || "";
    return { mode, apiKey, merchantCode };
  };

  const maskKey = (k: string) => {
    if (!k) return "";
    if (k.length <= 8) return "••••";
    return k.slice(0, 6) + "…" + k.slice(-4);
  };

  app.get("/api/admin/payments-config", async (_req, res) => {
    const cfg = await readPaymentsConfig();
    res.json({
      mode: cfg.mode,
      apiKeyMasked: maskKey(cfg.apiKey),
      hasApiKey: !!cfg.apiKey,
      merchantCode: cfg.merchantCode,
    });
  });

  app.post("/api/admin/payments-config", async (req, res) => {
    const schema = z.object({
      mode: z.enum(["mvp", "sumup"]).optional(),
      apiKey: z.string().optional(),
      merchantCode: z.string().optional(),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    const { mode, apiKey, merchantCode } = parse.data;
    if (mode !== undefined) await storage.setContent("payments_mode", mode);
    if (apiKey !== undefined && apiKey !== "") await storage.setContent("sumup_api_key", apiKey);
    if (merchantCode !== undefined) await storage.setContent("sumup_merchant_code", merchantCode);
    const cfg = await readPaymentsConfig();
    res.json({ ok: true, mode: cfg.mode, apiKeyMasked: maskKey(cfg.apiKey), hasApiKey: !!cfg.apiKey, merchantCode: cfg.merchantCode });
  });

  // Test SumUp connection: calls GET /v0.1/me with stored or supplied creds
  app.post("/api/admin/payments-config/test", async (req, res) => {
    const cfg = await readPaymentsConfig();
    const apiKey = (req.body?.apiKey as string) || cfg.apiKey;
    if (!apiKey) return res.status(400).json({ ok: false, error: "Missing SumUp API key" });
    try {
      const r = await fetch("https://api.sumup.com/v0.1/me", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!r.ok) {
        const text = await r.text();
        return res.status(400).json({ ok: false, status: r.status, error: text.slice(0, 300) });
      }
      const me = await r.json() as any;
      res.json({
        ok: true,
        merchantProfile: {
          merchant_code: me?.merchant_profile?.merchant_code,
          company_name: me?.merchant_profile?.company_name,
          country: me?.merchant_profile?.country,
          default_currency: me?.merchant_profile?.default_currency,
        },
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });

  // ========= PUBLIC SUMUP CHECKOUT =========

  // Create (or reuse) a SumUp Hosted Checkout for a booking; returns hosted_checkout_url.
  app.post("/api/public/bookings/:id/sumup-checkout", async (req, res) => {
    const id = Number(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.status === "confirmed" || booking.status === "completed") {
      return res.status(400).json({ error: "Booking already paid" });
    }

    const cfg = await readPaymentsConfig();
    if (cfg.mode !== "sumup" || !cfg.apiKey || !cfg.merchantCode) {
      return res.status(503).json({ error: "SumUp is not configured" });
    }

    const origin = (req.headers.origin as string) || `https://${req.headers.host}`;
    const returnUrl = `${origin}/#/pay/return/${booking.id}`;
    const reference = `spp-${booking.id}-${Date.now()}`;

    try {
      const r = await fetch("https://api.sumup.com/v0.1/checkouts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          checkout_reference: reference,
          amount: Number(booking.depositAmount.toFixed(2)),
          currency: "GBP",
          merchant_code: cfg.merchantCode,
          description: `Deposit for booking #${booking.id} on ${booking.date} ${booking.startTime}`,
          redirect_url: returnUrl,
          return_url: returnUrl,
          hosted_checkout: { enabled: true },
        }),
      });
      if (!r.ok) {
        const text = await r.text();
        return res.status(502).json({ error: "SumUp error", detail: text.slice(0, 500) });
      }
      const data = await r.json() as any;
      const checkoutId = data?.id;
      const hostedUrl = data?.hosted_checkout_url;
      if (!checkoutId || !hostedUrl) {
        return res.status(502).json({ error: "SumUp response missing fields", detail: data });
      }
      await storage.setBookingSumupCheckoutId(id, checkoutId);
      res.json({ checkoutId, hostedCheckoutUrl: hostedUrl, amount: booking.depositAmount });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  // Poll payment status. If SumUp says PAID, mark booking confirmed.
  app.get("/api/public/bookings/:id/payment-status", async (req, res) => {
    const id = Number(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ error: "Not found" });

    // Already confirmed/completed — no SumUp call needed.
    if (booking.status === "confirmed" || booking.status === "completed") {
      return res.json({ status: booking.status, sumupStatus: "PAID" });
    }

    const cfg = await readPaymentsConfig();
    if (!booking.sumupCheckoutId || cfg.mode !== "sumup" || !cfg.apiKey) {
      return res.json({ status: booking.status, sumupStatus: null });
    }

    try {
      const r = await fetch(`https://api.sumup.com/v0.1/checkouts/${encodeURIComponent(booking.sumupCheckoutId)}`, {
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
      });
      if (!r.ok) {
        const text = await r.text();
        return res.status(502).json({ error: "SumUp error", detail: text.slice(0, 300) });
      }
      const data = await r.json() as any;
      const sumupStatus = String(data?.status || "").toUpperCase();
      if (sumupStatus === "PAID") {
        const ref = data?.transactions?.[0]?.transaction_code || booking.sumupCheckoutId;
        const confirmed = await storage.updateBookingStatus(id, "confirmed", ref);
        if (confirmed) emailForBooking(confirmed).then((b) => sendBookingEmails(b)).catch((e) => console.error("[email]", e));
        return res.json({ status: "confirmed", sumupStatus });
      }
      return res.json({ status: booking.status, sumupStatus });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  // Public read of payments mode (so client can decide to redirect or show MVP message)
  app.get("/api/public/payments-mode", async (_req, res) => {
    const cfg = await readPaymentsConfig();
    res.json({ mode: cfg.mode });
  });

  // ========= ADMIN: BRANDING / BUSINESS / POLICY / SERVICE AREAS =========
  // All stored in the content k/v table. Fallbacks come from tenant.config.ts.

  const tc = tenantConfig;
  const val = async (key: string, fallback: string) =>
    (await storage.getContentValue(key)) ?? fallback;
  const intVal = async (key: string, fallback: number) => {
    const v = await storage.getContentValue(key);
    const n = v === undefined ? NaN : parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
  };
  const boolVal = async (key: string, fallback: boolean) => {
    const v = await storage.getContentValue(key);
    return v === undefined ? fallback : v === "true";
  };

  const defaultPolicyBody =
    "Cancellations made more than [N] hours before your booking receive a full deposit refund. Cancellations within [N] hours are non-refundable.";

  const readBusiness = async () => ({
    ownerName: await val("business.ownerName", tc.business.ownerName),
    brandName: await val("brand.name", tc.brand.name),
    brandShortName: await val("brand.shortName", tc.brand.shortName),
    tagline: await val("brand.tagline", tc.brand.tagline),
    instagram: await val("brand.instagram", tc.brand.instagram ?? ""),
    email: await val("business.email", tc.business.email),
    phone: await val("business.phone", tc.business.phoneDisplay || tc.business.phone),
  });

  const readBranding = async () => ({
    colors: {
      primary: await val("brand.color.primary", tc.brand.colors.primary),
      primaryFg: await val("brand.color.primaryFg", tc.brand.colors.primaryFg),
      accent: await val("brand.color.accent", tc.brand.colors.accent),
      accentFg: await val("brand.color.accentFg", tc.brand.colors.accentFg),
      tertiary: await val("brand.color.tertiary", tc.brand.colors.tertiary),
      tertiaryFg: await val("brand.color.tertiaryFg", tc.brand.colors.tertiaryFg),
      background: await val("brand.color.background", tc.brand.colors.background),
      foreground: await val("brand.color.foreground", tc.brand.colors.foreground),
      muted: await val("brand.color.muted", tc.brand.colors.muted),
      mutedFg: await val("brand.color.mutedFg", tc.brand.colors.mutedFg),
      border: await val("brand.color.border", tc.brand.colors.border),
    },
    fonts: {
      display: await val("brand.font.display", tc.brand.fonts.display),
      body: await val("brand.font.body", tc.brand.fonts.body),
    },
    italicAccent: await boolVal("brand.italicAccent", tc.brand.italicAccent ?? true),
  });

  const readPolicy = async () => ({
    cancellationNoticeHours: await intVal("policy.cancellationNoticeHours", 24),
    refundPercentInsideNotice: await intVal("policy.refundPercentInsideNotice", 0),
    body: await val("policy.body", defaultPolicyBody),
  });

  app.get("/api/admin/business-config", async (_req, res) => {
    res.json(await readBusiness());
  });
  app.post("/api/admin/business-config", async (req, res) => {
    const schema = z.object({
      ownerName: z.string().optional(),
      brandName: z.string().optional(),
      brandShortName: z.string().optional(),
      tagline: z.string().optional(),
      instagram: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    const d = parse.data;
    if (d.ownerName !== undefined) await storage.setContentValue("business.ownerName", d.ownerName);
    if (d.brandName !== undefined) await storage.setContentValue("brand.name", d.brandName);
    if (d.brandShortName !== undefined) await storage.setContentValue("brand.shortName", d.brandShortName);
    if (d.tagline !== undefined) await storage.setContentValue("brand.tagline", d.tagline);
    if (d.instagram !== undefined) await storage.setContentValue("brand.instagram", d.instagram.replace(/^@+/, "").trim());
    if (d.email !== undefined) await storage.setContentValue("business.email", d.email);
    if (d.phone !== undefined) await storage.setContentValue("business.phone", d.phone);
    res.json({ ok: true, ...(await readBusiness()) });
  });

  app.get("/api/admin/branding-config", async (_req, res) => {
    res.json(await readBranding());
  });
  app.post("/api/admin/branding-config", async (req, res) => {
    const schema = z.object({
      colors: z.object({
        primary: z.string().optional(),
        primaryFg: z.string().optional(),
        accent: z.string().optional(),
        accentFg: z.string().optional(),
        tertiary: z.string().optional(),
        tertiaryFg: z.string().optional(),
        background: z.string().optional(),
        foreground: z.string().optional(),
        muted: z.string().optional(),
        mutedFg: z.string().optional(),
        border: z.string().optional(),
      }).optional(),
      fonts: z.object({
        display: z.string().optional(),
        body: z.string().optional(),
      }).optional(),
      italicAccent: z.boolean().optional(),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    const { colors, fonts, italicAccent } = parse.data;
    if (colors?.primary !== undefined) await storage.setContentValue("brand.color.primary", colors.primary);
    if (colors?.primaryFg !== undefined) await storage.setContentValue("brand.color.primaryFg", colors.primaryFg);
    if (colors?.accent !== undefined) await storage.setContentValue("brand.color.accent", colors.accent);
    if (colors?.accentFg !== undefined) await storage.setContentValue("brand.color.accentFg", colors.accentFg);
    if (colors?.tertiary !== undefined) await storage.setContentValue("brand.color.tertiary", colors.tertiary);
    if (colors?.tertiaryFg !== undefined) await storage.setContentValue("brand.color.tertiaryFg", colors.tertiaryFg);
    if (colors?.background !== undefined) await storage.setContentValue("brand.color.background", colors.background);
    if (colors?.foreground !== undefined) await storage.setContentValue("brand.color.foreground", colors.foreground);
    if (colors?.muted !== undefined) await storage.setContentValue("brand.color.muted", colors.muted);
    if (colors?.mutedFg !== undefined) await storage.setContentValue("brand.color.mutedFg", colors.mutedFg);
    if (colors?.border !== undefined) await storage.setContentValue("brand.color.border", colors.border);
    if (fonts?.display !== undefined) await storage.setContentValue("brand.font.display", fonts.display);
    if (fonts?.body !== undefined) await storage.setContentValue("brand.font.body", fonts.body);
    if (italicAccent !== undefined) await storage.setContentValue("brand.italicAccent", String(italicAccent));
    res.json({ ok: true, ...(await readBranding()) });
  });

  app.get("/api/admin/policy-config", async (_req, res) => {
    res.json(await readPolicy());
  });
  app.post("/api/admin/policy-config", async (req, res) => {
    const schema = z.object({
      cancellationNoticeHours: z.number().int().min(0).optional(),
      refundPercentInsideNotice: z.number().int().min(0).max(100).optional(),
      body: z.string().optional(),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    const d = parse.data;
    if (d.cancellationNoticeHours !== undefined) await storage.setContentValue("policy.cancellationNoticeHours", String(d.cancellationNoticeHours));
    if (d.refundPercentInsideNotice !== undefined) await storage.setContentValue("policy.refundPercentInsideNotice", String(d.refundPercentInsideNotice));
    if (d.body !== undefined) await storage.setContentValue("policy.body", d.body);
    res.json({ ok: true, ...(await readPolicy()) });
  });

  // Public merged brand config — fetched on every page load, keep fast & cached.
  app.get("/api/public/brand-config", async (_req, res) => {
    const [business, branding, policy] = await Promise.all([
      readBusiness(),
      readBranding(),
      readPolicy(),
    ]);
    res.set("Cache-Control", "no-store, max-age=0");
    res.json({
      ...business,
      colors: branding.colors,
      fonts: branding.fonts,
      italicAccent: branding.italicAccent,
      policy,
    });
  });

  // ========= ADMIN: EMAILS =========

  app.get("/api/admin/email-config", async (_req, res) => {
    res.json(getEmailConfig());
  });

  app.post("/api/admin/email-config", async (req, res) => {
    const schema = z.object({
      enabled: z.boolean().optional(),
      fromEmail: z.string().optional(),
      fromName: z.string().optional(),
      bccOwner: z.boolean().optional(),
      ownerEmail: z.string().optional(),
      remindersEnabled: z.boolean().optional(),
      reminderHoursBefore: z.number().int().min(1).max(168).optional(),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    const d = parse.data;
    const current = getEmailConfig();
    const next: EmailConfig = {
      enabled: d.enabled ?? current.enabled,
      fromEmail: d.fromEmail ?? current.fromEmail,
      fromName: d.fromName ?? current.fromName,
      bccOwner: d.bccOwner ?? current.bccOwner,
      ownerEmail: d.ownerEmail ?? current.ownerEmail,
      remindersEnabled: d.remindersEnabled ?? current.remindersEnabled,
      reminderHoursBefore: d.reminderHoursBefore ?? current.reminderHoursBefore,
    };
    setEmailConfig(next);
    res.json(next);
  });

  app.get("/api/admin/email-templates", async (_req, res) => {
    res.json(getEmailTemplates());
  });

  app.post("/api/admin/email-templates", async (req, res) => {
    const tmpl = z.object({ subject: z.string(), body: z.string() });
    const schema = z.object({ customerConfirm: tmpl, ownerAlert: tmpl, newBookingRequest: tmpl, appointmentReminder: tmpl, cancellation: tmpl });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    setEmailTemplates(parse.data as EmailTemplates);
    res.json(getEmailTemplates());
  });

  app.post("/api/admin/email-test", async (req, res) => {
    const schema = z.object({ to: z.string().optional() });
    const parse = schema.safeParse(req.body ?? {});
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    try {
      await sendTestEmail(parse.data.to && parse.data.to.length > 0 ? parse.data.to : undefined);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  // Actually attempts an SMTP connection + login (no email sent) instead of
  // relying on interpreting an email-send error. Safe to run repeatedly.
  app.get("/api/admin/email-diagnostics", async (_req, res) => {
    const cfg = getEmailConfig();
    const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

    const result: {
      enabled: boolean;
      fromEmail: string;
      ownerEmail: string;
      smtpConfigured: boolean;
      smtpConnectionOk: boolean | null;
      error: string | null;
    } = {
      enabled: cfg.enabled,
      fromEmail: cfg.fromEmail,
      ownerEmail: cfg.ownerEmail,
      smtpConfigured,
      smtpConnectionOk: null,
      error: null,
    };

    if (!smtpConfigured) {
      result.error = "SMTP_HOST, SMTP_USER and SMTP_PASS must be set on the server (check Railway > Variables).";
      return res.json(result);
    }

    try {
      await verifySmtpConnection();
      result.smtpConnectionOk = true;
    } catch (e: any) {
      result.smtpConnectionOk = false;
      result.error = `Could not connect or log in: ${String(e?.message || e)}`;
    }
    res.json(result);
  });

  return httpServer;
}
