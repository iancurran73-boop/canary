import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Services the business offers (e.g. "Full Groom", "Bath & Tidy")
export const services = sqliteTable("services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  durationMinutes: integer("duration_minutes").notNull(), // total appointment length
  price: real("price").notNull(), // full price in GBP
  depositPercent: integer("deposit_percent").notNull().default(50),
  depositEnabled: integer("deposit_enabled", { mode: "boolean" }).notNull().default(true),
  imageUrl: text("image_url").default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  priceSmall: integer("price_small"),
  priceMedium: integer("price_medium"),
  priceLarge: integer("price_large"),
  priceXLarge: integer("price_xlarge"),
});

export const insertServiceSchema = createInsertSchema(services).omit({ id: true });
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;

// Weekly working hours – one row per day-of-week (0=Sunday … 6=Saturday)
export const workingHours = sqliteTable("working_hours", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dayOfWeek: integer("day_of_week").notNull(), // 0..6
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  startTime: text("start_time").notNull().default("09:00"), // "HH:MM"
  endTime: text("end_time").notNull().default("17:00"),
});

export const insertWorkingHoursSchema = createInsertSchema(workingHours).omit({ id: true });
export type InsertWorkingHours = z.infer<typeof insertWorkingHoursSchema>;
export type WorkingHours = typeof workingHours.$inferSelect;

// One-off blocked times (holidays, personal blocks)
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

// Bookings made by customers
export const bookings = sqliteTable("bookings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  serviceId: integer("service_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  notes: text("notes").default(""),
  date: text("date").notNull(), // "YYYY-MM-DD"
  startTime: text("start_time").notNull(), // "HH:MM"
  endTime: text("end_time").notNull(),
  totalPrice: real("total_price").notNull(),
  depositAmount: real("deposit_amount").notNull(),
  balanceDue: real("balance_due").notNull(),
  // pending = slot held, awaiting payment
  // confirmed = deposit paid, slot locked
  // cancelled = slot released
  // completed = appointment finished
  status: text("status").notNull().default("pending"),
  paymentRef: text("payment_ref").default(""), // Stripe checkout/session id (mock in prototype)
  createdAt: integer("created_at").notNull(),
  addressLine1: text("address_line1").notNull().default(""),
  postcode: text("postcode").notNull().default(""),
  dogName: text("dog_name").notNull().default(""),
  dogBreed: text("dog_breed").notNull().default(""),
  dogSize: text("dog_size").notNull().default(""),
  sumupCheckoutId: text("sumup_checkout_id").default(""),
  // Epoch ms of when a reminder email was sent (or when we gave up on one
  // because the appointment already passed); null = still awaiting one.
  reminderSentAt: integer("reminder_sent_at"),
});

// Repeat-customer info attached to admin booking responses (computed, not stored)
export type ReturningCustomerInfo = {
  visits: number;
  lastVisitDate: string | null;
  lastDogName: string | null;
  lastDogBreed: string | null;
  lastServiceName: string | null;
};

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  status: true,
  paymentRef: true,
  createdAt: true,
  endTime: true,
  totalPrice: true,
  depositAmount: true,
  balanceDue: true,
});
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;

// Studio settings (single-row config)
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studioName: text("studio_name").notNull().default("Sophie's Pampered Paws"),
  acceptingBookings: integer("accepting_bookings", { mode: "boolean" }).notNull().default(true),
  bufferMinutes: integer("buffer_minutes").notNull().default(15), // gap between bookings
  minNoticeHours: integer("min_notice_hours").notNull().default(24),
  maxAdvanceDays: integer("max_advance_days").notNull().default(60),
  notifyEmail: text("notify_email").notNull().default("hello@sophiespamperedpaws.co.uk"),
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
  dogName: text("dog_name").default(""),
  publishedAt: text("published_at").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

// Site pages — drives the nav. "core" rows point at built-in routes/components
// (Home, Services, etc.) and only their nav placement is editable here; "custom"
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
