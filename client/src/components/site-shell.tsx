/**
 * client/src/components/site-shell.tsx
 * ──────────────────────────────────────
 * Top-level page wrapper: navigation header + footer + mobile CTA.
 * All brand/contact/hours values are read from tenant.config.ts.
 */

import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Menu, X, MapPin, Phone, Mail, Instagram, ArrowRight } from "lucide-react";
import config from "@/lib/tenant";
import { useBrand } from "@/lib/brand";
import { usePages } from "@/lib/pages";
import type { WorkingHours } from "@shared/schema";

const { business, brand, hours } = config;

type HoursDict = Record<string, { enabled: boolean; start?: string; end?: string; note?: string }>;

/** Normalise DB working-hours rows into the keyed dict the renderers expect */
function dbHoursToDict(rows: WorkingHours[]): HoursDict {
  const out: HoursDict = {};
  rows.forEach((r) => {
    out[String(r.dayOfWeek)] = { enabled: r.enabled, start: r.startTime, end: r.endTime };
  });
  return out;
}

/**
 * useHours() — opening hours from /api/public/working-hours, falling back to
 * static tenant config when the DB has no rows yet. Shared by the utility bar
 * and the footer so admin edits are reflected everywhere.
 */
function useHours(): HoursDict {
  const { data: rows } = useQuery<WorkingHours[]>({
    queryKey: ["/api/public/working-hours"],
  });
  return rows && rows.length > 0 ? dbHoursToDict(rows) : (hours as HoursDict);
}

/** Render a short summary of opening hours for the top utility bar */
function buildHoursSummary(hoursDict: HoursDict): string {
  const days = Object.entries(hoursDict)
    .filter(([, v]) => v.enabled && v.start && v.end)
    .map(([day, v]) => ({ day: Number(day), start: v.start!, end: v.end! }));

  if (days.length === 0) return "";

  // Try to group consecutive days with the same hours
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const parts: string[] = [];

  // Group days by (start, end) pair
  const grouped = new Map<string, number[]>();
  days.forEach(({ day, start, end }) => {
    const key = `${start}-${end}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(day);
  });

  grouped.forEach((dayList, key) => {
    const [start, end] = key.split("-");
    const sorted = [...dayList].sort((a, b) => a - b);
    // Check if consecutive
    const isConsec = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
    if (isConsec && sorted.length > 1) {
      parts.push(`${dayNames[sorted[0]]}–${dayNames[sorted[sorted.length - 1]]} · ${start} – ${end}`);
    } else {
      sorted.forEach((d) => parts.push(`${dayNames[d]} · ${start} – ${end}`));
    }
  });

  return parts.join(" · ");
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const b = useBrand();
  const nav = usePages();
  const hoursSummary = buildHoursSummary(useHours());
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top utility bar */}
      <div className="hidden md:block bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-xs opacity-90" style={{ background: `hsl(${brand.colors.primary})`, color: `hsl(${brand.colors.primaryFg})` }}>
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <a href={`tel:${b.phone}`} className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity">
              <Phone className="size-3" /> {b.phone}
            </a>
            <a href={`mailto:${b.email}`} className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity">
              <Mail className="size-3" /> {b.email}
            </a>
            <span className="inline-flex items-center gap-1.5 opacity-85">
              <MapPin className="size-3" /> {business.address.line1}, {business.address.city} {business.address.postcode}
            </span>
          </div>
          <div className="flex items-center gap-3 opacity-95">
            {hoursSummary && <span>{hoursSummary}</span>}
            {b.instagram && (
              <a href={`https://www.instagram.com/${b.instagram}`} target="_blank" rel="noreferrer" className="hover:opacity-80">
                <Instagram className="size-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Sticky header */}
      <header className={`sticky top-0 z-40 bg-primary text-primary-foreground transition-shadow ${scrolled ? "shadow-xl" : ""}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4 py-3 sm:py-4">
          <Link href="/" className="flex items-center gap-3 sm:gap-5 group shrink-0" data-testid="link-home">
            <BrandMark className="h-10 sm:h-12 lg:h-14 w-auto text-white drop-shadow-md transition-transform group-hover:scale-[1.02]" />
            <div className="hidden md:block leading-tight">
              <div className="font-display font-extrabold text-white text-xl lg:text-2xl tracking-tight">{b.brandName}</div>
              <div className="text-xs lg:text-sm italic font-serif text-white/90 mt-0.5">{b.tagline}</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {nav.map((item) => {
              const active = location === item.path;
              return (
                <Link
                  key={item.slug}
                  href={item.path}
                  className={`relative px-3 py-2 text-sm font-semibold tracking-wide rounded-md transition-colors ${
                    active ? "text-white" : "text-white/85 hover:text-white"
                  }`}
                  data-testid={`nav-${item.slug}`}
                >
                  {item.navLabel}
                  {active && <span className="absolute left-3 right-3 -bottom-0.5 h-[2px] bg-white rounded-full" />}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/book" className="hidden md:inline-flex">
              <Button size="default" variant="secondary" className="rounded-full px-5 font-semibold shadow-lg" data-testid="button-book-header">
                Book now <ArrowRight className="size-4 ml-1" />
              </Button>
            </Link>
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setOpen((v) => !v)}
              className="lg:hidden p-2 rounded-md text-white hover:bg-white/10"
              data-testid="button-menu"
            >
              {open ? <X className="size-7" /> : <Menu className="size-7" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="lg:hidden border-t border-white/20 bg-primary">
            <nav className="px-4 py-3 grid gap-1">
              {nav.map((item) => (
                <Link
                  key={item.slug}
                  href={item.path}
                  className={`px-3 py-3 rounded-md text-base font-semibold ${location === item.path ? "bg-white/20 text-white" : "text-white/90 hover:bg-white/10"}`}
                >
                  {item.navLabel}
                </Link>
              ))}
              <Link href="/book" className="mt-2">
                <Button className="w-full rounded-full font-semibold py-6 text-base bg-white/15 text-white hover:bg-white/25">
                  Book an appointment <ArrowRight className="size-4 ml-1" />
                </Button>
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main>{children}</main>

      <SiteFooter />

      {/* Mobile sticky bottom CTA — hide on /book and /admin where it's redundant or in the way */}
      {!location.startsWith("/book") && !location.startsWith("/admin") && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 px-3 pb-3 pt-2 bg-gradient-to-t from-background via-background/95 to-transparent">
          <Link href="/book">
            <Button className="w-full rounded-full py-6 text-base font-semibold shadow-xl" data-testid="button-book-mobile-cta">
              Book your appointment <ArrowRight className="size-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function SiteFooter() {
  const b = useBrand();
  const nav = usePages();
  const footerHours = useHours();
  return (
    <footer className="bg-[hsl(var(--foreground))] text-[hsl(35_40%_92%)] mt-16 sm:mt-24 pb-28 lg:pb-12" style={{ background: `hsl(${brand.colors.foreground})` }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          <BrandMark className="h-12 w-auto text-white mb-4" />
          <p className="font-display font-bold text-lg text-white">{b.brandName}</p>
          <p className="font-serif italic text-sm text-white/70 mt-1">{b.tagline}</p>
        </div>
        <div>
          <h4 className="font-display font-bold text-sm uppercase tracking-[0.18em] text-accent mb-3">Studio</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <MapPin className="size-4 mt-0.5 shrink-0 text-accent" />
              {business.address.line1},<br /> {business.address.city} {business.address.postcode}
            </li>
            <li className="flex items-center gap-2">
              <Phone className="size-4 text-accent" />
              <a href={`tel:${b.phone}`} className="hover:text-accent">{b.phone}</a>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="size-4 text-accent" />
              <a href={`mailto:${b.email}`} className="hover:text-accent break-all">{b.email}</a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-display font-bold text-sm uppercase tracking-[0.18em] text-accent mb-3">Explore</h4>
          <ul className="space-y-2 text-sm">
            {nav.map((item) => (
              <li key={item.slug}><Link href={item.path} className="hover:text-accent">{item.navLabel}</Link></li>
            ))}
            <li><Link href="/book" className="hover:text-accent">Book online</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display font-bold text-sm uppercase tracking-[0.18em] text-accent mb-3">Hours</h4>
          <ul className="space-y-1 text-sm">
            {Object.entries(footerHours).sort(([a], [b]) => Number(a) - Number(b)).map(([day, v]) => {
              const dayNum = Number(day);
              const label = DAY_NAMES[dayNum];
              const value = !v.enabled
                ? "Closed"
                : v.note
                ? v.note
                : v.start && v.end
                ? `${v.start} – ${v.end}`
                : "Open";
              return (
                <li key={day} className={`flex justify-between ${!v.enabled ? "text-white/40" : ""}`}>
                  <span>{label}</span><span>{value}</span>
                </li>
              );
            })}
          </ul>
          {b.instagram && (
            <a
              href={`https://www.instagram.com/${b.instagram}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-sm hover:text-accent"
            >
              <Instagram className="size-4 text-accent" /> @{b.instagram}
            </a>
          )}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row justify-between gap-2 text-xs text-white/50">
          <p>© {new Date().getFullYear()} {b.brandName} · {business.address.city}</p>
          <p>Powered by GeneralBooking</p>
        </div>
      </div>
    </footer>
  );
}
