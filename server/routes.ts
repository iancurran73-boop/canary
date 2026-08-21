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
import { sendBookingEmails, sendNewBookingAlert, sendCancellationEmail, sendTestEmail } from "./email";
import {
  insertServiceSchema,
  insertBlockedDateSchema,
  insertSettingsSchema,
  insertWorkingHoursSchema,
  insertGalleryItemSchema,
  insertReviewSchema,
} from "@shared/schema";
import { PAGE_LAYOUT_IDS } from "@shared/page-layouts";
import { requireAdminAuth, issueSessionCookie, clearSessionCookie, checkLoginRateLimit, verifyPasscode } from "./adminAuth";
import { z } from "zod";
import tenantConfig from "../tenant.config";

const HHMM = /^\d{2}:\d{2}$/;
const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fromMinutes = (m: number) => {
  const h = Math.floor(m / 60).toString().padStart(2, "0");
  const mm = (m % 60).toString().padStart(2, "0");
  return `${h}:${mm}`;
};

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Map a stored booking row into the shape sendBookingEmails expects.
  const emailForBooking = async (booking: { serviceId: number } & Record<string, any>) => {
    const service = await storage.getService(booking.serviceId);
    return {
      customerName: booking.customerName,
      email: booking.customerEmail,
      phone: booking.customerPhone,
      postcode: booking.postcode,
      date: booking.date,
      time: booking.startTime,
      serviceName: service?.name ?? "",
      dogName: booking.dogName,
      breed: booking.dogBreed,
      size: booking.dogSize,
      depositPaid: typeof booking.depositAmount === "number" ? booking.depositAmount.toFixed(2) : booking.depositAmount,
      balanceDue: typeof booking.balanceDue === "number" ? booking.balanceDue.toFixed(2) : booking.balanceDue,
      notes: booking.notes,
    };
  };

  // ========= PUBLIC (widget) =========

  // List bookable services
  app.get("/api/public/services", async (_req, res) => {
    const list = await storage.listServices(true);
    res.json(list);
  });

  // Studio meta (used by the widget)
  app.get("/api/public/studio", async (_req, res) => {
    const s = await storage.getSettings();
    res.json({
      studioName: s.studioName,
      acceptingBookings: s.acceptingBookings,
      minNoticeHours: s.minNoticeHours,
      maxAdvanceDays: s.maxAdvanceDays,
    });
  });

  // Available start-times for a service on a given date.
  app.get("/api/public/availability", async (req, res) => {
    const date = String(req.query.date || "");
    const serviceId = Number(req.query.serviceId);
    if (!date || !serviceId) return res.status(400).json({ error: "date and serviceId required" });

    const service = await storage.getService(serviceId);
    if (!service || !service.active) return res.json({ slots: [] });

    const settings = await storage.getSettings();
    if (!settings.acceptingBookings) return res.json({ slots: [] });

    // notice window
    const target = new Date(date + "T00:00:00");
    const now = new Date();
    const minNoticeMs = settings.minNoticeHours * 3600_000;
    const maxAdvanceMs = settings.maxAdvanceDays * 86400_000;
    if (target.getTime() - now.getTime() > maxAdvanceMs) return res.json({ slots: [] });

    const dow = target.getDay();
    const wh = (await storage.listWorkingHours()).find((w) => w.dayOfWeek === dow);
    if (!wh || !wh.enabled) return res.json({ slots: [] });

    const dayStart = toMinutes(wh.startTime);
    const dayEnd = toMinutes(wh.endTime);
    const dur = service.durationMinutes;
    const buffer = settings.bufferMinutes;
    const step = 15; // 15-minute increments

    // Existing bookings that day
    const dayBookings = (await storage.listBookings(date, date)).filter(
      (b) => b.status === "pending" || b.status === "confirmed"
    );
    // Blocked
    const blocks = (await storage.listBlockedDates(date, date));

    const slots: string[] = [];
    for (let t = dayStart; t + dur <= dayEnd; t += step) {
      const slotEnd = t + dur;

      // Min notice
      const slotDate = new Date(target);
      slotDate.setMinutes(t);
      if (slotDate.getTime() - now.getTime() < minNoticeMs) continue;

      // Conflict with existing bookings (+ buffer either side)
      const conflict = dayBookings.some((b) => {
        const bs = toMinutes(b.startTime);
        const be = toMinutes(b.endTime);
        return t < be + buffer && slotEnd + buffer > bs;
      });
      if (conflict) continue;

      // Conflict with blocked
      const blocked = blocks.some((bd) => {
        if (!bd.startTime || !bd.endTime) return true; // whole day
        const bs = toMinutes(bd.startTime);
        const be = toMinutes(bd.endTime);
        return t < be && slotEnd > bs;
      });
      if (blocked) continue;

      slots.push(fromMinutes(t));
    }

    res.json({ slots, durationMinutes: dur });
  });

  // Create a booking (status=pending) and return a mock checkout url
  app.post("/api/public/bookings", async (req, res) => {
    const bodySchema = z.object({
      serviceId: z.number().int(),
      customerName: z.string().min(1),
      customerEmail: z.string().email(),
      customerPhone: z.string().min(5),
      notes: z.string().optional().default(""),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      startTime: z.string().regex(HHMM),
      addressLine1: z.string().min(1, "Address required"),
      postcode: z.string().min(3, "Postcode required"),
      dogName: z.string().min(1, "Dog name required"),
      dogBreed: z.string().min(1, "Dog breed required"),
      dogSize: z.enum(["small", "medium", "large", "xlarge"]),
    });
    const parse = bodySchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    const data = parse.data;

    const service = await storage.getService(data.serviceId);
    if (!service || !service.active) return res.status(400).json({ error: "Service unavailable" });

    const startMin = toMinutes(data.startTime);
    const endMin = startMin + service.durationMinutes;
    const endTime = fromMinutes(endMin);

    // Final slot check (race protection)
    const sameDay = (await storage.listBookings(data.date, data.date)).filter(
      (b) => b.status === "pending" || b.status === "confirmed"
    );
    const settings = await storage.getSettings();
    const conflict = sameDay.some((b) => {
      const bs = toMinutes(b.startTime);
      const be = toMinutes(b.endTime);
      return startMin < be + settings.bufferMinutes && endMin + settings.bufferMinutes > bs;
    });
    if (conflict) return res.status(409).json({ error: "Slot just got taken — please pick another." });

    // Determine price by size, falling back to base price
    const sizePrice: Record<string, number | null | undefined> = {
      small: service.priceSmall,
      medium: service.priceMedium,
      large: service.priceLarge,
      xlarge: service.priceXLarge,
    };
    const totalPrice = sizePrice[data.dogSize] ?? service.price;
    // A service can have deposits switched off entirely (Admin > Services). When
    // off, there's nothing to collect up front, but the booking still lands as
    // "pending" like any other — it just needs a manual "Mark confirmed" from
    // the owner instead of a deposit payment before it's locked in.
    const depositRequired = service.depositEnabled && service.depositPercent > 0;
    const depositAmount = depositRequired
      ? Math.round((totalPrice * service.depositPercent) / 100 * 100) / 100
      : 0;
    const balanceDue = Math.round((totalPrice - depositAmount) * 100) / 100;

    const booking = await storage.createBooking({
      serviceId: service.id,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      notes: data.notes,
      date: data.date,
      startTime: data.startTime,
      endTime,
      totalPrice,
      depositAmount,
      balanceDue,
      status: "pending",
      paymentRef: "",
      createdAt: Date.now(),
      addressLine1: data.addressLine1,
      postcode: data.postcode,
      dogName: data.dogName,
      dogBreed: data.dogBreed,
      dogSize: data.dogSize,
      reminderSentAt: null,
    });

    // Tell the owner a new request has come in right away — this is
    // separate from the "booking confirmed" alert below, which only fires
    // once the booking is actually confirmed (payment or manual review).
    emailForBooking(booking).then((b) => sendNewBookingAlert(b)).catch((e) => console.error("[email]", e));

    res.json({
      bookingId: booking.id,
      depositAmount,
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
    const svc = await storage.getService(b.serviceId);
    res.json({ ...b, service: svc });
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

  app.get("/api/admin/services", async (_req, res) => {
    res.json(await storage.listServices(false));
  });
  app.post("/api/admin/services", async (req, res) => {
    const parse = insertServiceSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    res.json(await storage.createService(parse.data));
  });
  app.patch("/api/admin/services/:id", async (req, res) => {
    const id = Number(req.params.id);
    const parse = insertServiceSchema.partial().safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    const updated = await storage.updateService(id, parse.data);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });
  app.delete("/api/admin/services/:id", async (req, res) => {
    const id = Number(req.params.id);
    res.json({ ok: await storage.deleteService(id) });
  });

  app.get("/api/admin/working-hours", async (_req, res) => {
    res.json(await storage.listWorkingHours());
  });
  app.put("/api/admin/working-hours", async (req, res) => {
    const arr = z.array(insertWorkingHoursSchema).safeParse(req.body);
    if (!arr.success) return res.status(400).json({ error: arr.error.flatten() });
    res.json(await storage.upsertWorkingHours(arr.data));
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
    const services = await storage.listServices(false);
    const enriched = await Promise.all(list.map(async (b) => {
      const hist = await storage.getCustomerHistory(b.customerEmail, b.customerPhone, b.id);
      const returningCustomer = hist.visits > 0 ? {
        visits: hist.visits,
        lastVisitDate: hist.lastVisitDate,
        lastDogName: hist.lastDogName,
        lastDogBreed: hist.lastDogBreed,
        lastServiceName: hist.lastServiceId != null
          ? (services.find((s) => s.id === hist.lastServiceId)?.name ?? null)
          : null,
      } : null;
      return { ...b, service: services.find((s) => s.id === b.serviceId), returningCustomer };
    }));
    res.json(enriched);
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

  app.get("/api/public/reviews", async (_req, res) => {
    res.json(await storage.listReviews(true));
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

  // ========= ADMIN PAGES =========
  // Core pages (Home, Services, Gallery, About, Contact, How It Works) are
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
    });
    const parse = bodySchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

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

  const defaultPolicyBody =
    "Cancellations made more than [N] hours before your appointment receive a full booking fee refund. Cancellations within [N] hours are non-refundable.";

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
      accent: await val("brand.color.accent", tc.brand.colors.accent),
      background: await val("brand.color.background", tc.brand.colors.background),
      foreground: await val("brand.color.foreground", tc.brand.colors.foreground),
    },
    fonts: {
      display: await val("brand.font.display", tc.brand.fonts.display),
      body: await val("brand.font.body", tc.brand.fonts.body),
    },
  });

  const readPolicy = async () => ({
    cancellationNoticeHours: await intVal("policy.cancellationNoticeHours", 24),
    refundPercentInsideNotice: await intVal("policy.refundPercentInsideNotice", 0),
    body: await val("policy.body", defaultPolicyBody),
  });

  const readServiceAreas = async (): Promise<string[]> => {
    const raw = await storage.getContentValue("serviceAreas.outcodes");
    if (raw === undefined) return ["NE22", "NE23", "NE24", "NE25", "NE26", "NE27", "NE28", "NE61", "NE62", "NE63", "NE64", "NE65"];
    return raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  };

  const normaliseOutcodes = (arr: string[]) =>
    Array.from(new Set(arr.map((s) => s.trim().toUpperCase()).filter(Boolean)));

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
        accent: z.string().optional(),
        background: z.string().optional(),
        foreground: z.string().optional(),
      }).optional(),
      fonts: z.object({
        display: z.string().optional(),
        body: z.string().optional(),
      }).optional(),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    const { colors, fonts } = parse.data;
    if (colors?.primary !== undefined) await storage.setContentValue("brand.color.primary", colors.primary);
    if (colors?.accent !== undefined) await storage.setContentValue("brand.color.accent", colors.accent);
    if (colors?.background !== undefined) await storage.setContentValue("brand.color.background", colors.background);
    if (colors?.foreground !== undefined) await storage.setContentValue("brand.color.foreground", colors.foreground);
    if (fonts?.display !== undefined) await storage.setContentValue("brand.font.display", fonts.display);
    if (fonts?.body !== undefined) await storage.setContentValue("brand.font.body", fonts.body);
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

  app.get("/api/admin/service-areas", async (_req, res) => {
    res.json({ outcodes: await readServiceAreas() });
  });
  app.post("/api/admin/service-areas", async (req, res) => {
    const schema = z.object({ outcodes: z.array(z.string()) });
    const parse = schema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
    const normalised = normaliseOutcodes(parse.data.outcodes);
    await storage.setContentValue("serviceAreas.outcodes", normalised.join(","));
    res.json({ ok: true, outcodes: normalised });
  });

  // Public merged brand config — fetched on every page load, keep fast & cached.
  app.get("/api/public/brand-config", async (_req, res) => {
    const [business, branding, policy, serviceAreas] = await Promise.all([
      readBusiness(),
      readBranding(),
      readPolicy(),
      readServiceAreas(),
    ]);
    res.set("Cache-Control", "no-store, max-age=0");
    res.json({
      ...business,
      colors: branding.colors,
      fonts: branding.fonts,
      policy,
      serviceAreas,
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

  // Checks Resend's own state directly (API key validity + domain
  // verification) instead of relying on interpreting an email-send error.
  // Doesn't send anything, so it's safe to run repeatedly while debugging.
  app.get("/api/admin/email-diagnostics", async (_req, res) => {
    const apiKey = process.env.RESEND_API_KEY;
    const cfg = getEmailConfig();
    const fromDomain = cfg.fromEmail.includes("@") ? cfg.fromEmail.split("@")[1] : null;

    const result: {
      enabled: boolean;
      fromEmail: string;
      ownerEmail: string;
      apiKeySet: boolean;
      apiKeyValid: boolean | null;
      domains: { name: string; status: string }[];
      fromDomainVerified: boolean | null;
      error: string | null;
    } = {
      enabled: cfg.enabled,
      fromEmail: cfg.fromEmail,
      ownerEmail: cfg.ownerEmail,
      apiKeySet: !!apiKey,
      apiKeyValid: null,
      domains: [],
      fromDomainVerified: null,
      error: null,
    };

    if (!apiKey) {
      result.error = "RESEND_API_KEY is not set on the server (check Railway > Variables).";
      return res.json(result);
    }
    if (!fromDomain) {
      result.error = "From email in Admin > Emails is missing or not a valid address.";
    }

    try {
      const r = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (r.status === 401 || r.status === 403) {
        result.apiKeyValid = false;
        result.error = `Resend rejected this API key (${r.status}). It may be wrong, revoked, or from a different Resend account.`;
        return res.json(result);
      }
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        result.error = `Resend error ${r.status}: ${text.slice(0, 300)}`;
        return res.json(result);
      }
      result.apiKeyValid = true;
      const data = await r.json() as { data?: { name: string; status: string }[] };
      result.domains = (data.data ?? []).map((d) => ({ name: d.name, status: d.status }));
      if (fromDomain) {
        const match = result.domains.find((d) => d.name === fromDomain);
        result.fromDomainVerified = match?.status === "verified";
        if (!match) {
          result.error = `The domain "${fromDomain}" (from your From email) hasn't been added to this Resend account at all.`;
        } else if (match.status !== "verified") {
          result.error = `The domain "${fromDomain}" is added to Resend but its status is "${match.status}", not "verified". Check the DNS records Resend asked for.`;
        }
      }
      res.json(result);
    } catch (e: any) {
      result.error = `Could not reach Resend: ${String(e?.message || e)}`;
      res.json(result);
    }
  });

  return httpServer;
}
