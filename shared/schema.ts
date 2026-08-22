import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Weekly opening hours for the function room — one row per day-of-week (0=Sunday … 6=Saturday)
export const workingHours = sqliteTable("working_hours", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dayOfWeek: integer("day_of_week").notNull(), // 0..6
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  startTime: text("start_time").notNull().default("19:00"), // "HH:MM"
  endTime: text("end_time").notNull().default("23:00"),
});

export const insertWorkingHoursSchema = createInsertSchema(workingHours).omit({ id: true });
export type InsertWorkingHours = z.infer<typeof insertWorkingHoursSchema>;
export type WorkingHours = typeof workingHours.$inferSelect;

// One-off blocked times (private events, closures)
export const blockedDates = sqliteTable("blocked_dates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // ISO date "YYYY-MM-DD"
  startTime: text("start_time"), // null = whole day
  endTime: text("end_time"),
  reason: text("reason").default(""),
});

export const insertBlockedDateSchema = createInsertSchema(blockedDates).omit({ id: true });
export type InsertBlockedDate = z.infer<typeof insertBlockedDateSchema>;
export type BlockedDate = typeof blockedDates.$inferSelect;

// Function room bookings. There's only one bookable thing (the room itself),
// booked exclusively per session — no services, no per-size pricing. A flat
// deposit (settings.depositAmount) secures the booking and comes back to the
// customer as a bar tab on the night, so there's no "total price"/balance
// concept the way an itemised booking would have.
export const bookings = sqliteTable("bookings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  eventType: text("event_type").notNull().default(""), // e.g. "Birthday", "Hen do", "Corporate", "Just because"
  partySize: integer("party_size").notNull().default(1),
  notes: text("notes").default(""),
  shoutOuts: text("shout_outs").notNull().default(""), // song requests / shout-outs for the DJ
  date: text("date").notNull(), // "YYYY-MM-DD"
  startTime: text("start_time").notNull(), // "HH:MM"
  endTime: text("end_time").notNull(),
  depositAmount: real("deposit_amount").notNull(),
  // pending = slot held, awaiting deposit payment
  // confirmed = deposit paid (or manually confirmed), session locked
  // cancelled = slot released
  // completed = session finished
  status: text("status").notNull().default("pending"),
  paymentRef: text("payment_ref").default(""),
  createdAt: integer("created_at").notNull(),
  sumupCheckoutId: text("sumup_checkout_id").default(""),
  // Epoch ms of when a reminder email was sent (or when we gave up on one
  // because the session already passed); null = still awaiting one.
  reminderSentAt: integer("reminder_sent_at"),
});

// Repeat-customer info attached to admin booking responses (computed, not stored)
export type ReturningCustomerInfo = {
  visits: number;
  lastVisitDate: string | null;
  lastEventType: string | null;
};

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  status: true,
  paymentRef: true,
  createdAt: true,
  endTime: true,
  depositAmount: true,
});
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;

// Venue settings (single-row config)
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studioName: text("studio_name").notNull().default("The Singing Canary"),
  acceptingBookings: integer("accepting_bookings", { mode: "boolean" }).notNull().default(true),
  // How long a booked session runs — there's one room and one session length,
  // not a per-service duration.
  sessionDurationMinutes: integer("session_duration_minutes").notNull().default(240),
  bufferMinutes: integer("buffer_minutes").notNull().default(30), // gap between sessions (setup/clear-down)
  minNoticeHours: integer("min_notice_hours").notNull().default(48),
  maxAdvanceDays: integer("max_advance_days").notNull().default(90),
  // Flat refundable deposit — comes back as a bar tab on the night.
  depositAmount: real("deposit_amount").notNull().default(150),
  notifyEmail: text("notify_email").notNull().default(""),
  calendarConnected: integer("calendar_connected", { mode: "boolean" }).notNull().default(false),
  pushEnabled: integer("push_enabled", { mode: "boolean" }).notNull().default(false),
  stripeMode: text("stripe_mode").notNull().default("test"), // "test" | "live"
});

export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

// Key/value content store - used by InlineText/ImageDropzone for all editable text + images
export const content = sqliteTable("content", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: integer("updated_at").notNull(),
});
export type ContentRow = typeof content.$inferSelect;

// Gallery items
export const galleryItems = sqliteTable("gallery_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  imageUrl: text("image_url").notNull(),
  caption: text("caption").default(""),
  category: text("category").default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
});
export const insertGalleryItemSchema = createInsertSchema(galleryItems).omit({ id: true, createdAt: true });
export type InsertGalleryItem = z.infer<typeof insertGalleryItemSchema>;
export type GalleryItem = typeof galleryItems.$inferSelect;

// Reviews
export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  authorName: text("author_name").notNull(),
  rating: integer("rating").notNull().default(5),
  body: text("body").notNull(),
  publishedAt: text("published_at").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

// Events — one-off nights (karaoke championships, theme nights, live acts),
// distinct from the bookable function room. Public page lists upcoming ones.
export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  date: text("date").notNull(), // "YYYY-MM-DD"
  startTime: text("start_time").notNull().default(""), // "HH:MM", optional
  imageUrl: text("image_url").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
});
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

// Site pages — drives the nav. "core" rows point at built-in routes/components
// (Home, Contact, etc.) and only their nav placement is editable here; "custom"
// rows are admin-created pages rendered by the generic layout renderer, with
// content stored in the `content` table under "page.<slug>.<field>" keys.
export const pages = sqliteTable("pages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  navLabel: text("nav_label").notNull(),
  path: text("path").notNull(),
  kind: text("kind").notNull().default("custom"), // "core" | "custom"
  layout: text("layout"), // null for core; layout id for custom (see LAYOUTS)
  sortOrder: integer("sort_order").notNull().default(0),
  visible: integer("visible", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
});
export const insertPageSchema = createInsertSchema(pages).omit({ id: true, createdAt: true });
export type InsertPage = z.infer<typeof insertPageSchema>;
export type Page = typeof pages.$inferSelect;
