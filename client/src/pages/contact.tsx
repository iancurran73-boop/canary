/**
 * client/src/pages/contact.tsx
 * ─────────────────────────────
 * Contact page — service area, phone, email, map, hours.
 * All values driven by tenant.config.ts.
 */

import { useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { applySeo, breadcrumb } from "@/lib/seo";
import { Phone, Mail, Instagram, Clock, ArrowRight, Bus } from "lucide-react";
import config from "@/lib/tenant";
import { useContent } from "@/lib/content";
import { useBrand } from "@/lib/brand";
import type { WorkingHours } from "@shared/schema";

const { business, brand, hours } = config;

function dbHoursToConfigHours(
  rows: WorkingHours[]
): Record<string, { enabled: boolean; start: string; end: string; note?: string }> {
  const out: Record<string, any> = {};
  rows.forEach((r) => {
    out[String(r.dayOfWeek)] = { enabled: r.enabled, start: r.startTime, end: r.endTime };
  });
  return out;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Contact() {
  const { c } = useContent();
  const b = useBrand();

  const { data: dbHoursRows } = useQuery<WorkingHours[]>({
    queryKey: ["/api/public/working-hours"],
  });
  // Use DB hours if available, otherwise fall back to static config
  const displayHours = dbHoursRows && dbHoursRows.length > 0
    ? dbHoursToConfigHours(dbHoursRows)
    : hours as Record<string, { enabled: boolean; start: string; end: string; note?: string }>;

  const phone = c("contact.phone", b.phone);
  const phoneDisplay = c("contact.phoneDisplay", b.phone);
  const email = c("contact.email", b.email);
  const city = c("contact.city", business.address.city);
  const postcode = c("contact.postcode", business.address.postcode);
  const instagram = c("contact.instagram", b.instagram ?? "");
  const hoursNote = c("contact.hoursNote", "");

  useEffect(() => {
    applySeo({
      title: `Contact ${b.brandName} · ${business.address.city}`,
      description: `Get in touch with ${b.brandName} for in-home dog grooming in ${city}. Call ${business.phoneDisplay} or email ${business.email}.`,
      path: "/contact",
      jsonLd: [breadcrumb([{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }])],
    });
  }, [city]);

  const serviceOutcodes = b.serviceAreas ?? [];
  const areaLabel =
    serviceOutcodes.length > 1
      ? `${serviceOutcodes.slice(0, -1).join(", ")} & ${serviceOutcodes[serviceOutcodes.length - 1]}`
      : serviceOutcodes[0] ?? postcode;

  return (
    <SiteShell>
      <section className="bg-gradient-to-br from-[hsl(35_40%_97%)] to-[hsl(35_40%_92%)] pt-12 sm:pt-20 pb-10 sm:pb-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p className="text-xs uppercase tracking-[0.28em] text-primary font-bold">Contact</p>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight mt-3 leading-[1.05] max-w-3xl">
            Get in <span className="font-serif italic font-medium text-primary">touch</span>.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            {b.brandName} is an in-home service based in {city}, covering local appointments across Northumberland.
          </p>
        </div>
      </section>

      <section className="py-10 sm:py-14 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-card border border-card-border rounded-2xl p-6 sm:p-7 shadow-sm space-y-4">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0"><Phone className="size-5" /></div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground">Phone</p>
                  <a href={`tel:${phone}`} className="font-display font-bold text-lg hover:text-primary block mt-1">{phoneDisplay}</a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0"><Mail className="size-5" /></div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground">Email</p>
                  <a href={`mailto:${email}`} className="font-display font-bold text-base sm:text-lg hover:text-primary block mt-1 break-all">{email}</a>
                </div>
              </div>
              {instagram && (
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0"><Instagram className="size-5" /></div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground">Instagram</p>
                    <a href={`https://www.instagram.com/${instagram}`} target="_blank" rel="noreferrer" className="font-display font-bold text-lg hover:text-primary block mt-1">@{instagram}</a>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-card border border-card-border rounded-2xl p-6 sm:p-7 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0"><Clock className="size-5" /></div>
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground">Working hours</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {Object.entries(displayHours).sort(([a], [b]) => Number(a) - Number(b)).map(([day, v]) => {
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
                        <li key={day} className={`flex justify-between ${!v.enabled ? "text-muted-foreground" : ""}`}>
                          <span>{label}</span>
                          <span className={v.enabled ? "font-semibold" : ""}>{value}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {hoursNote && <p className="text-xs text-muted-foreground mt-3">{hoursNote}</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-5">
            <div className="rounded-2xl overflow-hidden border border-card-border shadow-sm bg-card">
              <img
                src={`${import.meta.env.BASE_URL || "./"}img/service-area-map.png`}
                alt={`Service area map — postcodes covered by ${b.brandName}: ${areaLabel}`}
                className="w-full h-auto block"
                loading="lazy"
              />
            </div>
            <p className="text-xs text-muted-foreground text-center -mt-1">Covering postcodes {areaLabel}</p>
            <div className="bg-card border border-card-border rounded-2xl p-5 sm:p-6">
              <Bus className="size-5 text-primary" />
              <h3 className="font-display font-bold text-base mt-3">Need to check coverage?</h3>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">Send your postcode before booking if you're just outside {city} and I'll confirm whether I can travel to you.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 bg-foreground text-white text-center">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight">
            Skip the back-and-forth.
          </h2>
          <p className="text-white/80 mt-3 text-base">
            Book online in under a minute — {b.ownerName} gets notified straight away.
          </p>
          <Link href="/book">
            <Button size="lg" className="rounded-full px-8 py-6 mt-7 text-base font-semibold shadow-xl">
              Book your appointment <ArrowRight className="size-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
