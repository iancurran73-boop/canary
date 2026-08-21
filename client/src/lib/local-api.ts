// Client-side API replacement.
// Intercepts /api/* fetches and serves them from localStorage so the booking
// system runs without a backend (fully functional on *.pplx.app).
//
// Schema mirrors server/storage.ts exactly. To swap in a real backend later,
// remove the fetch interceptor and point client at the real /api endpoints.

type Service = {
  id: number; name: string; description: string;
  durationMinutes: number; price: number; depositPercent: number;
  imageUrl: string; active: boolean; sortOrder: number;
};
type WorkingHours = {
  id: number; dayOfWeek: number; enabled: boolean;
  startTime: string; endTime: string;
};
type BlockedDate = {
  id: number; date: string; startTime: string | null;
  endTime: string | null; reason: string;
};
type Booking = {
  id: number; serviceId: number;
  customerName: string; customerEmail: string; customerPhone: string;
  notes: string;
  date: string; startTime: string; endTime: string;
  totalPrice: number; depositAmount: number; balanceDue: number;
  status: string; paymentRef: string; createdAt: number;
};
type Settings = {
  id: number; studioName: string; acceptingBookings: boolean;
  bufferMinutes: number; minNoticeHours: number; maxAdvanceDays: number;
  notifyEmail: string; calendarConnected: boolean; pushEnabled: boolean;
  stripeMode: string;
};

type DB = {
  services: Service[];
  workingHours: WorkingHours[];
  blockedDates: BlockedDate[];
  bookings: Booking[];
  settings: Settings;
  nextId: { service: number; workingHours: number; blockedDate: number; booking: number };
};

const STORAGE_KEY = "spp:db:v1";

function defaultDb(): DB {
  return {
    services: [
      { id: 1, name: "Full Groom", description: "Bath, dry, cut, brush, nails and finish.", durationMinutes: 120, price: 30, depositPercent: 25, imageUrl: "", active: true, sortOrder: 1 },
      { id: 2, name: "Bath & Tidy Up", description: "Bath, blow dry, brush and light tidy.", durationMinutes: 120, price: 30, depositPercent: 25, imageUrl: "", active: true, sortOrder: 2 },
      { id: 3, name: "Bath & Deshed", description: "Deep bath, deshedding treatment and dry.", durationMinutes: 120, price: 30, depositPercent: 25, imageUrl: "", active: true, sortOrder: 3 },
      { id: 4, name: "Nail Clipping", description: "Quick, calm trim with treats.", durationMinutes: 15, price: 10, depositPercent: 0, imageUrl: "", active: true, sortOrder: 4 },
      { id: 5, name: "Feet Trim", description: "Trim around the paws.", durationMinutes: 15, price: 10, depositPercent: 0, imageUrl: "", active: true, sortOrder: 5 },
    ],
    workingHours: [
      { id: 1, dayOfWeek: 0, enabled: false, startTime: "09:00", endTime: "17:00" },
      { id: 2, dayOfWeek: 1, enabled: true, startTime: "09:00", endTime: "17:00" },
      { id: 3, dayOfWeek: 2, enabled: true, startTime: "09:00", endTime: "17:00" },
      { id: 4, dayOfWeek: 3, enabled: true, startTime: "09:00", endTime: "17:00" },
      { id: 5, dayOfWeek: 4, enabled: true, startTime: "09:00", endTime: "17:00" },
      { id: 6, dayOfWeek: 5, enabled: true, startTime: "09:00", endTime: "17:00" },
      { id: 7, dayOfWeek: 6, enabled: true, startTime: "09:00", endTime: "17:00" },
    ],
    blockedDates: [],
    bookings: [],
    settings: {
      id: 1, studioName: "Sophie's Pampered Paws", acceptingBookings: true,
      bufferMinutes: 15, minNoticeHours: 24, maxAdvanceDays: 60,
      notifyEmail: "hello@sophiespamperedpaws.co.uk",
      calendarConnected: false, pushEnabled: false, stripeMode: "test",
    },
    nextId: { service: 6, workingHours: 8, blockedDate: 1, booking: 1 },
  };
}

function loadDb(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const db = defaultDb();
      saveDb(db);
      return db;
    }
    const parsed = JSON.parse(raw) as DB;
    // Light migration: ensure all keys present
    const def = defaultDb();
    return {
      services: parsed.services ?? def.services,
      workingHours: parsed.workingHours ?? def.workingHours,
      blockedDates: parsed.blockedDates ?? def.blockedDates,
      bookings: parsed.bookings ?? def.bookings,
      settings: { ...def.settings, ...(parsed.settings ?? {}) },
      nextId: { ...def.nextId, ...(parsed.nextId ?? {}) },
    };
  } catch {
    const db = defaultDb();
    saveDb(db);
    return db;
  }
}

function saveDb(db: DB) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch { /* quota */ }
}

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fromMinutes(m: number) {
  const h = Math.floor(m / 60).toString().padStart(2, "0");
  const mm = (m % 60).toString().padStart(2, "0");
  return `${h}:${mm}`;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json" },
  });
}

// ===== Route handlers =====

function handle(method: string, path: string, body: any): Response {
  const db = loadDb();

  // ---- PUBLIC ----
  if (method === "GET" && path === "/api/public/services") {
    return json(db.services.filter((s) => s.active).sort((a, b) => a.sortOrder - b.sortOrder));
  }
  if (method === "GET" && path === "/api/public/studio") {
    const s = db.settings;
    return json({
      studioName: s.studioName,
      acceptingBookings: s.acceptingBookings,
      minNoticeHours: s.minNoticeHours,
      maxAdvanceDays: s.maxAdvanceDays,
    });
  }
  if (method === "GET" && path === "/api/public/availability") {
    const url = new URL(path, "http://x");
    // path here doesn't carry query; caller passes as searchParams via second arg? handled below.
    return json({ slots: [] });
  }

  // Public: GET booking by id
  const getBookingMatch = path.match(/^\/api\/public\/bookings\/(\d+)$/);
  if (method === "GET" && getBookingMatch) {
    const id = Number(getBookingMatch[1]);
    const b = db.bookings.find((x) => x.id === id);
    if (!b) return json({ error: "Not found" }, 404);
    const svc = db.services.find((s) => s.id === b.serviceId);
    return json({ ...b, service: svc });
  }

  // Public: confirm payment
  const confirmMatch = path.match(/^\/api\/public\/bookings\/(\d+)\/confirm-payment$/);
  if (method === "POST" && confirmMatch) {
    const id = Number(confirmMatch[1]);
    const b = db.bookings.find((x) => x.id === id);
    if (!b) return json({ error: "Not found" }, 404);
    b.status = "confirmed";
    b.paymentRef = body?.paymentRef || `mock_${Date.now()}`;
    saveDb(db);
    return json(b);
  }

  // Public: create booking
  if (method === "POST" && path === "/api/public/bookings") {
    const data = body || {};
    const service = db.services.find((s) => s.id === data.serviceId);
    if (!service || !service.active) return json({ error: "Service unavailable" }, 400);

    const startMin = toMinutes(data.startTime);
    const endMin = startMin + service.durationMinutes;
    const endTime = fromMinutes(endMin);

    const sameDay = db.bookings.filter(
      (b) => b.date === data.date && (b.status === "pending" || b.status === "confirmed")
    );
    const conflict = sameDay.some((b) => {
      const bs = toMinutes(b.startTime);
      const be = toMinutes(b.endTime);
      return startMin < be + db.settings.bufferMinutes &&
             endMin + db.settings.bufferMinutes > bs;
    });
    if (conflict) return json({ error: "Slot just got taken — please pick another." }, 409);

    const totalPrice = service.price;
    const depositAmount = Math.round((totalPrice * service.depositPercent) / 100 * 100) / 100;
    const balanceDue = Math.round((totalPrice - depositAmount) * 100) / 100;

    const booking: Booking = {
      id: db.nextId.booking++,
      serviceId: service.id,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      notes: data.notes || "",
      date: data.date,
      startTime: data.startTime,
      endTime,
      totalPrice, depositAmount, balanceDue,
      status: "pending", paymentRef: "",
      createdAt: Date.now(),
    };
    db.bookings.push(booking);
    saveDb(db);

    return json({
      bookingId: booking.id,
      depositAmount,
    });
  }

  // ---- ADMIN ----
  if (method === "GET" && path === "/api/admin/services") {
    return json([...db.services].sort((a, b) => a.sortOrder - b.sortOrder));
  }
  if (method === "POST" && path === "/api/admin/services") {
    const s: Service = {
      id: db.nextId.service++,
      name: body.name, description: body.description || "",
      durationMinutes: body.durationMinutes, price: body.price,
      depositPercent: body.depositPercent ?? 50,
      imageUrl: body.imageUrl || "",
      active: body.active ?? true,
      sortOrder: body.sortOrder ?? 0,
    };
    db.services.push(s);
    saveDb(db);
    return json(s);
  }
  const svcMatch = path.match(/^\/api\/admin\/services\/(\d+)$/);
  if (method === "PATCH" && svcMatch) {
    const id = Number(svcMatch[1]);
    const idx = db.services.findIndex((x) => x.id === id);
    if (idx === -1) return json({ error: "Not found" }, 404);
    db.services[idx] = { ...db.services[idx], ...body };
    saveDb(db);
    return json(db.services[idx]);
  }
  if (method === "DELETE" && svcMatch) {
    const id = Number(svcMatch[1]);
    db.services = db.services.filter((x) => x.id !== id);
    saveDb(db);
    return json({ ok: true });
  }

  if (method === "GET" && path === "/api/admin/working-hours") {
    return json([...db.workingHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek));
  }
  if (method === "PUT" && path === "/api/admin/working-hours") {
    const arr = (body || []) as WorkingHours[];
    db.workingHours = arr.map((r, i) => ({
      id: i + 1,
      dayOfWeek: r.dayOfWeek,
      enabled: !!r.enabled,
      startTime: r.startTime || "09:00",
      endTime: r.endTime || "18:00",
    }));
    saveDb(db);
    return json([...db.workingHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek));
  }

  if (method === "GET" && path === "/api/admin/blocked-dates") {
    return json([...db.blockedDates].sort((a, b) => a.date.localeCompare(b.date)));
  }
  if (method === "POST" && path === "/api/admin/blocked-dates") {
    const b: BlockedDate = {
      id: db.nextId.blockedDate++,
      date: body.date,
      startTime: body.startTime ?? null,
      endTime: body.endTime ?? null,
      reason: body.reason || "",
    };
    db.blockedDates.push(b);
    saveDb(db);
    return json(b);
  }
  const blockedMatch = path.match(/^\/api\/admin\/blocked-dates\/(\d+)$/);
  if (method === "DELETE" && blockedMatch) {
    const id = Number(blockedMatch[1]);
    db.blockedDates = db.blockedDates.filter((x) => x.id !== id);
    saveDb(db);
    return json({ ok: true });
  }

  if (method === "GET" && path === "/api/admin/bookings") {
    const enriched = [...db.bookings]
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
      .map((b) => ({ ...b, service: db.services.find((s) => s.id === b.serviceId) }));
    return json(enriched);
  }
  const cancelMatch = path.match(/^\/api\/admin\/bookings\/(\d+)\/cancel$/);
  if (method === "POST" && cancelMatch) {
    const id = Number(cancelMatch[1]);
    const b = db.bookings.find((x) => x.id === id);
    if (!b) return json({ error: "Not found" }, 404);
    b.status = "cancelled";
    saveDb(db);
    return json(b);
  }
  const completeMatch = path.match(/^\/api\/admin\/bookings\/(\d+)\/complete$/);
  if (method === "POST" && completeMatch) {
    const id = Number(completeMatch[1]);
    const b = db.bookings.find((x) => x.id === id);
    if (!b) return json({ error: "Not found" }, 404);
    b.status = "completed";
    saveDb(db);
    return json(b);
  }

  if (method === "GET" && path === "/api/admin/settings") {
    return json(db.settings);
  }
  if (method === "PATCH" && path === "/api/admin/settings") {
    db.settings = { ...db.settings, ...body };
    saveDb(db);
    return json(db.settings);
  }

  return json({ error: `No handler for ${method} ${path}` }, 404);
}

// Special handler for availability since it needs the query string
function handleAvailability(searchParams: URLSearchParams): Response {
  const date = searchParams.get("date") || "";
  const serviceId = Number(searchParams.get("serviceId"));
  if (!date || !serviceId) return json({ error: "date and serviceId required" }, 400);

  const db = loadDb();
  const service = db.services.find((s) => s.id === serviceId);
  if (!service || !service.active) return json({ slots: [] });
  if (!db.settings.acceptingBookings) return json({ slots: [] });

  const target = new Date(date + "T00:00:00");
  const now = new Date();
  const minNoticeMs = db.settings.minNoticeHours * 3600_000;
  const maxAdvanceMs = db.settings.maxAdvanceDays * 86400_000;
  if (target.getTime() - now.getTime() > maxAdvanceMs) return json({ slots: [] });

  const dow = target.getDay();
  const wh = db.workingHours.find((w) => w.dayOfWeek === dow);
  if (!wh || !wh.enabled) return json({ slots: [] });

  const dayStart = toMinutes(wh.startTime);
  const dayEnd = toMinutes(wh.endTime);
  const dur = service.durationMinutes;
  const buffer = db.settings.bufferMinutes;
  const step = 15;

  const dayBookings = db.bookings.filter(
    (b) => b.date === date && (b.status === "pending" || b.status === "confirmed")
  );
  const blocks = db.blockedDates.filter((bd) => bd.date === date);

  const slots: string[] = [];
  for (let t = dayStart; t + dur <= dayEnd; t += step) {
    const slotEnd = t + dur;
    const slotDate = new Date(target);
    slotDate.setMinutes(t);
    if (slotDate.getTime() - now.getTime() < minNoticeMs) continue;

    const conflict = dayBookings.some((b) => {
      const bs = toMinutes(b.startTime);
      const be = toMinutes(b.endTime);
      return t < be + buffer && slotEnd + buffer > bs;
    });
    if (conflict) continue;

    const blocked = blocks.some((bd) => {
      if (!bd.startTime || !bd.endTime) return true;
      const bs = toMinutes(bd.startTime);
      const be = toMinutes(bd.endTime);
      return t < be && slotEnd > bs;
    });
    if (blocked) continue;

    slots.push(fromMinutes(t));
  }

  return json({ slots, durationMinutes: dur });
}

// ===== Install fetch interceptor =====

let installed = false;
export function installLocalApi() {
  if (installed) return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET")).toUpperCase();

    // Parse path + search regardless of full URL or relative
    let pathname = url;
    let searchParams = new URLSearchParams();
    try {
      const u = new URL(url, window.location.origin);
      pathname = u.pathname;
      searchParams = u.searchParams;
    } catch { /* keep raw */ }

    if (!pathname.startsWith("/api/")) {
      return originalFetch(input as any, init);
    }

    let bodyData: any = undefined;
    if (init?.body) {
      try { bodyData = JSON.parse(init.body as string); } catch { bodyData = init.body; }
    }

    if (method === "GET" && pathname === "/api/public/availability") {
      return handleAvailability(searchParams);
    }
    return handle(method, pathname, bodyData);
  };
}

// ===== Helpers exposed for admin reset/seed =====

export function resetDb() {
  localStorage.removeItem(STORAGE_KEY);
  loadDb(); // re-seeds defaults
}

export function exportDb(): string {
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function importDb(json: string) {
  try {
    JSON.parse(json); // validate
    localStorage.setItem(STORAGE_KEY, json);
  } catch {
    throw new Error("Invalid backup data");
  }
}
