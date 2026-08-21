/**
 * client/src/pages/book.tsx
 * ──────────────────────────
 * Booking page — wrapper around BookingWidget.
 * Copy (hero subtitle, contact info) driven by tenant.config.ts.
 */

import { useEffect } from "react";
import { SiteShell } from "@/components/site-shell";
import { BookingWidget } from "@/components/booking-widget";
import { applySeo, breadcrumb } from "@/lib/seo";
import { Shield, Clock, CalendarCheck, CreditCard } from "lucide-react";
import config from "@/lib/tenant";
import { useBrand } from "@/lib/brand";

const { copy, business, brand } = config;

export default function Book() {
  const b = useBrand();
  useEffect(() => {
    applySeo({
      title: `Book the Room · ${brand.name} ${business.address.city}`,
      description: `Book ${brand.name}'s private function room in under 60 seconds. Pick a date, tell us the occasion, and secure it with a £150 deposit — refunded as a bar tab on the night.`,
      path: "/book",
      jsonLd: [
        breadcrumb([
          { name: "Home", path: "/" },
          { name: "Book", path: "/book" },
        ]),
      ],
    });
  }, []);

  return (
    <SiteShell>
      {/* Page header */}
      <section className="bg-gradient-to-br from-[hsl(var(--sidebar))] via-[hsl(var(--sidebar))] to-primary/30 text-white pt-12 sm:pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-accent font-bold">Online booking</p>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight mt-3 leading-[1.05]">
            Get your <span className="font-serif accent-italic font-medium text-accent">private room</span> booked
          </h1>
          <p className="mt-5 text-base sm:text-lg text-white/80 max-w-2xl mx-auto">
            {copy.bookingHeroSubtitle}
          </p>
          <div className="mt-7 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto text-xs sm:text-sm">
            {[
              { icon: CalendarCheck, label: "Real-time slots" },
              { icon: Shield, label: "Personal reply" },
              { icon: CreditCard, label: "£150 deposit" },
              { icon: Clock, label: "Cancel free 48h" },
            ].map((b) => (
              <div key={b.label} className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-3 flex items-center gap-2 ring-1 ring-white/15">
                <b.icon className="size-4 text-accent shrink-0" />
                <span className="font-medium">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Widget */}
      <section className="py-10 sm:py-16 bg-background">
        <div className="max-w-3xl mx-auto px-3 sm:px-6">
          <BookingWidget />
        </div>
      </section>

      {/* Help */}
      <section className="pb-16 sm:pb-24 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-display font-bold text-xl sm:text-2xl">Need help booking?</h2>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            If your preferred time isn't showing or you'd rather book by phone, get in touch directly.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3 text-sm">
            <a href={`tel:${b.phone}`} className="px-5 py-3 rounded-full bg-card border border-card-border hover-elevate font-medium">
              Call {b.phone}
            </a>
            <a href={`mailto:${b.email}`} className="px-5 py-3 rounded-full bg-card border border-card-border hover-elevate font-medium">
              Email {b.ownerName.split(" ")[0]}
            </a>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
