import {
  workingHours,
  blockedDates,
  bookings,
  settings,
  content,
  galleryItems,
  reviews,
  events,
  pages,
} from "@shared/schema";
import type {
  WorkingHours, InsertWorkingHours,
  BlockedDate, InsertBlockedDate,
  Booking, InsertBooking,
  Settings, InsertSettings,
  ContentRow,
  GalleryItem, InsertGalleryItem,
  Review, InsertReview,
  Event, InsertEvent,
  Page, InsertPage,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, gte, lte, asc, isNull } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

// Database path: use DATABASE_PATH env var if set (e.g. Railway volume mount),
// otherwise fall back to ./data.db for local dev.
const dbPath = process.env.DATABASE_PATH || "data.db";
const dbDir = path.dirname(dbPath);
if (dbDir && dbDir !== "." && !fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
console.log(`[storage] Using SQLite database at: ${dbPath}`);
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// --- migrations / setup ---
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS working_hours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week INTEGER NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    start_time TEXT NOT NULL DEFAULT '19:00',
    end_time TEXT NOT NULL DEFAULT '23:00'
  );
  CREATE TABLE IF NOT EXISTS blocked_dates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    reason TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    event_type TEXT NOT NULL DEFAULT '',
    party_size INTEGER NOT NULL DEFAULT 1,
    notes TEXT DEFAULT '',
    shout_outs TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    deposit_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_ref TEXT DEFAULT '',
    created_at INTEGER NOT NULL,
    sumup_checkout_id TEXT DEFAULT '',
    reminder_sent_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    studio_name TEXT NOT NULL DEFAULT 'The Singing Canary',
    accepting_bookings INTEGER NOT NULL DEFAULT 1,
    session_duration_minutes INTEGER NOT NULL DEFAULT 240,
    buffer_minutes INTEGER NOT NULL DEFAULT 30,
    min_notice_hours INTEGER NOT NULL DEFAULT 48,
    max_advance_days INTEGER NOT NULL DEFAULT 90,
    deposit_amount REAL NOT NULL DEFAULT 150,
    notify_email TEXT NOT NULL DEFAULT '',
    calendar_connected INTEGER NOT NULL DEFAULT 0,
    push_enabled INTEGER NOT NULL DEFAULT 0,
    stripe_mode TEXT NOT NULL DEFAULT 'test'
  );
  CREATE TABLE IF NOT EXISTS content (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS gallery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_url TEXT NOT NULL,
    caption TEXT DEFAULT '',
    category TEXT DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_name TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 5,
    body TEXT NOT NULL,
    published_at TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    start_time TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    nav_label TEXT NOT NULL,
    path TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'custom',
    layout TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    visible INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );
`);

// ALTER TABLE migrations for bookings — SQLite has no IF NOT EXISTS for
// ADD COLUMN, so we wrap each in try/catch and no-op if it already exists.
const bookingAlters = [
  "ALTER TABLE bookings ADD COLUMN shout_outs TEXT NOT NULL DEFAULT ''",
];
for (const sql of bookingAlters) {
  try { sqlite.exec(sql); } catch { /* column already exists */ }
}

// --- seed defaults if empty ---
const seedIfEmpty = () => {
  const settingsRow = db.select().from(settings).get();
  if (!settingsRow) {
    db.insert(settings).values({
      studioName: "The Singing Canary",
      acceptingBookings: true,
      sessionDurationMinutes: 240,
      bufferMinutes: 30,
      minNoticeHours: 48,
      maxAdvanceDays: 90,
      depositAmount: 150,
      notifyEmail: "",
      calendarConnected: false,
      pushEnabled: false,
      stripeMode: "test",
    }).run();
  }

  const wh = db.select().from(workingHours).all();
  if (wh.length === 0) {
    // Fri/Sat get three fixed 4-hour session slots (afternoon, evening, late
    // night through to 3am); every other day is closed by default, with one
    // disabled placeholder row so the admin can turn it on later.
    for (let d = 0; d < 7; d++) {
      if (d === 5 || d === 6) { // Fri, Sat
        db.insert(workingHours).values({ dayOfWeek: d, enabled: true, startTime: "13:00", endTime: "17:00" }).run();
        db.insert(workingHours).values({ dayOfWeek: d, enabled: true, startTime: "18:00", endTime: "22:00" }).run();
        db.insert(workingHours).values({ dayOfWeek: d, enabled: true, startTime: "23:00", endTime: "03:00" }).run();
      } else {
        db.insert(workingHours).values({ dayOfWeek: d, enabled: false, startTime: "19:00", endTime: "23:00" }).run();
      }
    }
  }

  const pgs = db.select().from(pages).all();
  if (pgs.length === 0) {
    const now = Date.now();
    const coreSeed: InsertPage[] = [
      { slug: "home", navLabel: "Home", path: "/", kind: "core", layout: null, sortOrder: 0, visible: true },
      { slug: "how-it-works", navLabel: "How It Works", path: "/how-it-works", kind: "core", layout: null, sortOrder: 1, visible: true },
      { slug: "gallery", navLabel: "Gallery", path: "/gallery", kind: "core", layout: null, sortOrder: 2, visible: true },
      { slug: "events", navLabel: "Events", path: "/events", kind: "core", layout: null, sortOrder: 3, visible: true },
      { slug: "about", navLabel: "About", path: "/about", kind: "core", layout: null, sortOrder: 4, visible: true },
      { slug: "contact", navLabel: "Contact", path: "/contact", kind: "core", layout: null, sortOrder: 5, visible: true },
    ];
    for (const p of coreSeed) db.insert(pages).values({ ...p, createdAt: now }).run();
  }
};
seedIfEmpty();

export interface IStorage {
  // working hours
  listWorkingHours(): Promise<WorkingHours[]>;
  upsertWorkingHours(rows: InsertWorkingHours[]): Promise<WorkingHours[]>;

  // blocked dates
  listBlockedDates(from?: string, to?: string): Promise<BlockedDate[]>;
  createBlockedDate(b: InsertBlockedDate): Promise<BlockedDate>;
  deleteBlockedDate(id: number): Promise<boolean>;

  // bookings
  listBookings(from?: string, to?: string): Promise<Booking[]>;
  getBooking(id: number): Promise<Booking | undefined>;
  createBooking(b: Omit<Booking, "id">): Promise<Booking>;
  updateBookingStatus(id: number, status: string, paymentRef?: string): Promise<Booking | undefined>;
  setBookingSumupCheckoutId(id: number, checkoutId: string): Promise<Booking | undefined>;
  cancelBooking(id: number): Promise<Booking | undefined>;
  listBookingsAwaitingReminder(): Promise<Booking[]>;
  markBookingReminderSent(id: number): Promise<void>;
  getCustomerHistory(email: string, phone: string, excludeBookingId?: number): Promise<{
    visits: number;
    lastVisitDate: string | null;
    lastEventType: string | null;
  }>;

  // settings
  getSettings(): Promise<Settings>;
  updateSettings(s: Partial<InsertSettings>): Promise<Settings>;

  // content
  listContent(): Promise<ContentRow[]>;
  getContent(key: string): Promise<ContentRow | undefined>;
  setContent(key: string, value: string): Promise<ContentRow>;
  deleteContent(key: string): Promise<boolean>;
  getContentValue(key: string): Promise<string | undefined>;
  setContentValue(key: string, value: string): Promise<void>;

  // gallery
  listGalleryItems(activeOnly: boolean): Promise<GalleryItem[]>;
  createGalleryItem(data: InsertGalleryItem): Promise<GalleryItem>;
  updateGalleryItem(id: number, data: Partial<InsertGalleryItem>): Promise<GalleryItem | undefined>;
  deleteGalleryItem(id: number): Promise<boolean>;

  // reviews
  listReviews(activeOnly: boolean): Promise<Review[]>;
  createReview(data: InsertReview): Promise<Review>;
  updateReview(id: number, data: Partial<InsertReview>): Promise<Review | undefined>;
  deleteReview(id: number): Promise<boolean>;

  // events
  listEvents(activeOnly: boolean, from?: string): Promise<Event[]>;
  getEvent(id: number): Promise<Event | undefined>;
  createEvent(data: InsertEvent): Promise<Event>;
  updateEvent(id: number, data: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: number): Promise<boolean>;

  // pages
  listPages(visibleOnly: boolean): Promise<Page[]>;
  getPage(id: number): Promise<Page | undefined>;
  getPageBySlug(slug: string): Promise<Page | undefined>;
  createPage(data: InsertPage): Promise<Page>;
  updatePage(id: number, data: Partial<InsertPage>): Promise<Page | undefined>;
  deletePage(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async listWorkingHours() {
    return db.select().from(workingHours).orderBy(asc(workingHours.dayOfWeek)).all();
  }
  async upsertWorkingHours(rows: InsertWorkingHours[]) {
    db.delete(workingHours).run();
    for (const r of rows) db.insert(workingHours).values(r).run();
    return this.listWorkingHours();
  }

  async listBlockedDates(from?: string, to?: string) {
    let q = db.select().from(blockedDates).$dynamic();
    if (from && to) q = q.where(and(gte(blockedDates.date, from), lte(blockedDates.date, to)));
    else if (from) q = q.where(gte(blockedDates.date, from));
    return q.orderBy(asc(blockedDates.date)).all();
  }
  async createBlockedDate(b: InsertBlockedDate) {
    return db.insert(blockedDates).values(b).returning().get();
  }
  async deleteBlockedDate(id: number) {
    const r = db.delete(blockedDates).where(eq(blockedDates.id, id)).run();
    return r.changes > 0;
  }

  async listBookings(from?: string, to?: string) {
    let q = db.select().from(bookings).$dynamic();
    if (from && to) q = q.where(and(gte(bookings.date, from), lte(bookings.date, to)));
    else if (from) q = q.where(gte(bookings.date, from));
    return q.orderBy(asc(bookings.date), asc(bookings.startTime)).all();
  }
  async getBooking(id: number) {
    return db.select().from(bookings).where(eq(bookings.id, id)).get();
  }
  async createBooking(b: Omit<Booking, "id">) {
    return db.insert(bookings).values(b).returning().get();
  }
  async updateBookingStatus(id: number, status: string, paymentRef?: string) {
    const update: Record<string, unknown> = { status };
    if (paymentRef !== undefined) update.paymentRef = paymentRef;
    db.update(bookings).set(update).where(eq(bookings.id, id)).run();
    return this.getBooking(id);
  }
  async setBookingSumupCheckoutId(id: number, checkoutId: string) {
    db.update(bookings).set({ sumupCheckoutId: checkoutId }).where(eq(bookings.id, id)).run();
    return this.getBooking(id);
  }
  async cancelBooking(id: number) {
    db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, id)).run();
    return this.getBooking(id);
  }
  async listBookingsAwaitingReminder() {
    return db.select().from(bookings)
      .where(and(eq(bookings.status, "confirmed"), isNull(bookings.reminderSentAt)))
      .all();
  }
  async markBookingReminderSent(id: number) {
    db.update(bookings).set({ reminderSentAt: Date.now() }).where(eq(bookings.id, id)).run();
  }

  async getCustomerHistory(email: string, phone: string, excludeBookingId?: number) {
    const normEmail = email.trim().toLowerCase();
    const normPhone = phone.replace(/\s/g, "");
    const all = db.select().from(bookings).all();
    const past = all.filter((b) => {
      if (excludeBookingId !== undefined && b.id === excludeBookingId) return false;
      if (b.status !== "confirmed" && b.status !== "completed") return false;
      const emailMatch = normEmail.length > 0 && b.customerEmail.trim().toLowerCase() === normEmail;
      const phoneMatch = normPhone.length > 0 && b.customerPhone.replace(/\s/g, "") === normPhone;
      return emailMatch || phoneMatch;
    });
    past.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const last = past[0];
    return {
      visits: past.length,
      lastVisitDate: last ? last.date : null,
      lastEventType: last ? (last.eventType || null) : null,
    };
  }

  async getSettings() {
    const row = db.select().from(settings).get();
    return row!;
  }
  async updateSettings(s: Partial<InsertSettings>) {
    const cur = db.select().from(settings).get();
    if (!cur) {
      return db.insert(settings).values(s as InsertSettings).returning().get();
    }
    db.update(settings).set(s).where(eq(settings.id, cur.id)).run();
    return (await this.getSettings());
  }

  async listContent() {
    return db.select().from(content).all();
  }
  async getContent(key: string) {
    return db.select().from(content).where(eq(content.key, key)).get();
  }
  async setContent(key: string, value: string) {
    const now = Date.now();
    const existing = db.select().from(content).where(eq(content.key, key)).get();
    if (existing) {
      db.update(content).set({ value, updatedAt: now }).where(eq(content.key, key)).run();
    } else {
      db.insert(content).values({ key, value, updatedAt: now }).run();
    }
    return db.select().from(content).where(eq(content.key, key)).get()!;
  }
  async deleteContent(key: string) {
    const r = db.delete(content).where(eq(content.key, key)).run();
    return r.changes > 0;
  }
  async getContentValue(key: string) {
    return db.select().from(content).where(eq(content.key, key)).get()?.value;
  }
  async setContentValue(key: string, value: string) {
    await this.setContent(key, value);
  }

  async listGalleryItems(activeOnly: boolean) {
    const rows = activeOnly
      ? db.select().from(galleryItems).where(eq(galleryItems.active, true)).orderBy(asc(galleryItems.sortOrder), asc(galleryItems.id)).all()
      : db.select().from(galleryItems).orderBy(asc(galleryItems.sortOrder), asc(galleryItems.id)).all();
    return rows;
  }
  async createGalleryItem(data: InsertGalleryItem) {
    return db.insert(galleryItems).values({ ...data, createdAt: Date.now() }).returning().get();
  }
  async updateGalleryItem(id: number, data: Partial<InsertGalleryItem>) {
    db.update(galleryItems).set(data).where(eq(galleryItems.id, id)).run();
    return db.select().from(galleryItems).where(eq(galleryItems.id, id)).get();
  }
  async deleteGalleryItem(id: number) {
    const r = db.delete(galleryItems).where(eq(galleryItems.id, id)).run();
    return r.changes > 0;
  }

  async listReviews(activeOnly: boolean) {
    const rows = activeOnly
      ? db.select().from(reviews).where(eq(reviews.active, true)).orderBy(asc(reviews.sortOrder)).all()
      : db.select().from(reviews).orderBy(asc(reviews.sortOrder)).all();
    return rows;
  }
  async createReview(data: InsertReview) {
    return db.insert(reviews).values({ ...data, createdAt: Date.now() }).returning().get();
  }
  async updateReview(id: number, data: Partial<InsertReview>) {
    db.update(reviews).set(data).where(eq(reviews.id, id)).run();
    return db.select().from(reviews).where(eq(reviews.id, id)).get();
  }
  async deleteReview(id: number) {
    const r = db.delete(reviews).where(eq(reviews.id, id)).run();
    return r.changes > 0;
  }

  async listEvents(activeOnly: boolean, from?: string) {
    let q = db.select().from(events).$dynamic();
    if (activeOnly && from) q = q.where(and(eq(events.active, true), gte(events.date, from)));
    else if (activeOnly) q = q.where(eq(events.active, true));
    else if (from) q = q.where(gte(events.date, from));
    return q.orderBy(asc(events.date)).all();
  }
  async getEvent(id: number) {
    return db.select().from(events).where(eq(events.id, id)).get();
  }
  async createEvent(data: InsertEvent) {
    return db.insert(events).values({ ...data, createdAt: Date.now() }).returning().get();
  }
  async updateEvent(id: number, data: Partial<InsertEvent>) {
    db.update(events).set(data).where(eq(events.id, id)).run();
    return db.select().from(events).where(eq(events.id, id)).get();
  }
  async deleteEvent(id: number) {
    const r = db.delete(events).where(eq(events.id, id)).run();
    return r.changes > 0;
  }

  async listPages(visibleOnly: boolean) {
    const rows = visibleOnly
      ? db.select().from(pages).where(eq(pages.visible, true)).orderBy(asc(pages.sortOrder)).all()
      : db.select().from(pages).orderBy(asc(pages.sortOrder)).all();
    return rows;
  }
  async getPage(id: number) {
    return db.select().from(pages).where(eq(pages.id, id)).get();
  }
  async getPageBySlug(slug: string) {
    return db.select().from(pages).where(eq(pages.slug, slug)).get();
  }
  async createPage(data: InsertPage) {
    return db.insert(pages).values({ ...data, createdAt: Date.now() }).returning().get();
  }
  async updatePage(id: number, data: Partial<InsertPage>) {
    db.update(pages).set(data).where(eq(pages.id, id)).run();
    return db.select().from(pages).where(eq(pages.id, id)).get();
  }
  async deletePage(id: number) {
    const r = db.delete(pages).where(eq(pages.id, id)).run();
    return r.changes > 0;
  }
}

export const storage = new DatabaseStorage();

// --- email config / templates (k/v JSON in the content table) ---

export type EmailConfig = {
  enabled: boolean;
  // Address on a domain verified with Resend, e.g. bookings@yourvenue.co.uk.
  // The Resend API key itself lives in the RESEND_API_KEY env var, not here.
  fromEmail: string;
  fromName: string;
  bccOwner: boolean;
  ownerEmail: string;
  remindersEnabled: boolean;
  reminderHoursBefore: number;
};

export type EmailTemplate = { subject: string; body: string };
export type EmailTemplates = {
  customerConfirm: EmailTemplate;
  ownerAlert: EmailTemplate;
  newBookingRequest: EmailTemplate;
  appointmentReminder: EmailTemplate;
  cancellation: EmailTemplate;
};

const EMAIL_CONFIG_KEY = "email_config";
const EMAIL_TEMPLATES_KEY = "email_templates";

const defaultEmailConfig: EmailConfig = {
  enabled: false,
  fromEmail: "",
  fromName: "The Singing Canary",
  bccOwner: false,
  ownerEmail: "",
  remindersEnabled: false,
  reminderHoursBefore: 48,
};

const defaultEmailTemplates: EmailTemplates = {
  customerConfirm: {
    subject: "Your booking at {business} on {date}",
    body: `Hi {customer},

Thanks for booking the function room at {business}! Here are your details:

Date: {date} at {time}
Party size: {partySize}
Occasion: {eventType}
Deposit paid: £{deposit} — this comes back to you as a bar tab on the night

If you need to change or cancel, please get in touch as soon as you can.

See you soon,
{ownerName}`,
  },
  ownerAlert: {
    subject: "New booking: {customer} on {date}",
    body: `New booking confirmed.

Customer: {customer}
Phone: {phone}
Email: {email}

Date: {date} at {time}
Party size: {partySize}
Occasion: {eventType}
Deposit paid: £{deposit}

Notes: {notes}
DJ shout-outs: {shoutOuts}`,
  },
  newBookingRequest: {
    subject: "New booking request: {customer} on {date}",
    body: `New booking request — needs your confirmation.

Customer: {customer}
Phone: {phone}
Email: {email}

Date: {date} at {time}
Party size: {partySize}
Occasion: {eventType}
{depositStatus}

Notes: {notes}
DJ shout-outs: {shoutOuts}

Review and confirm it in the admin panel.`,
  },
  appointmentReminder: {
    subject: "Reminder: your booking at {business}",
    body: `Hi {customer},

Just a reminder that your function room booking is coming up at {business}:

Date: {date} at {time}
Party size: {partySize}

If you need to change or cancel, please get in touch as soon as you can.

See you soon,
{ownerName}`,
  },
  cancellation: {
    subject: "Your booking at {business} has been cancelled",
    body: `Hi {customer},

This is to confirm your function room booking has been cancelled:

Date: {date} at {time}
Occasion: {eventType}

If this wasn't you, or you'd like to rebook, just get in touch or head back to the site.

{ownerName}`,
  },
};

function readJSON<T>(key: string): T | undefined {
  const row = db.select().from(content).where(eq(content.key, key)).get();
  if (!row) return undefined;
  try { return JSON.parse(row.value) as T; } catch { return undefined; }
}

function writeJSON(key: string, value: unknown): void {
  const now = Date.now();
  const str = JSON.stringify(value);
  const existing = db.select().from(content).where(eq(content.key, key)).get();
  if (existing) {
    db.update(content).set({ value: str, updatedAt: now }).where(eq(content.key, key)).run();
  } else {
    db.insert(content).values({ key, value: str, updatedAt: now }).run();
  }
}

export function getEmailConfig(): EmailConfig {
  return { ...defaultEmailConfig, ...(readJSON<EmailConfig>(EMAIL_CONFIG_KEY) ?? {}) };
}

export function setEmailConfig(cfg: EmailConfig): EmailConfig {
  writeJSON(EMAIL_CONFIG_KEY, cfg);
  return cfg;
}

export function getEmailTemplates(): EmailTemplates {
  const stored = readJSON<Partial<EmailTemplates>>(EMAIL_TEMPLATES_KEY) ?? {};
  return {
    customerConfirm: { ...defaultEmailTemplates.customerConfirm, ...(stored.customerConfirm ?? {}) },
    ownerAlert: { ...defaultEmailTemplates.ownerAlert, ...(stored.ownerAlert ?? {}) },
    newBookingRequest: { ...defaultEmailTemplates.newBookingRequest, ...(stored.newBookingRequest ?? {}) },
    appointmentReminder: { ...defaultEmailTemplates.appointmentReminder, ...(stored.appointmentReminder ?? {}) },
    cancellation: { ...defaultEmailTemplates.cancellation, ...(stored.cancellation ?? {}) },
  };
}

export function setEmailTemplates(t: EmailTemplates): EmailTemplates {
  writeJSON(EMAIL_TEMPLATES_KEY, t);
  return t;
}

export function getBusinessConfig(): { name?: string; ownerName?: string; email?: string; phone?: string } {
  return {
    name: db.select().from(content).where(eq(content.key, "brand.name")).get()?.value,
    ownerName: db.select().from(content).where(eq(content.key, "business.ownerName")).get()?.value,
    email: db.select().from(content).where(eq(content.key, "business.email")).get()?.value,
    phone: db.select().from(content).where(eq(content.key, "business.phone")).get()?.value,
  };
}
