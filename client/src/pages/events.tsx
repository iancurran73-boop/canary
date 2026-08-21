/**
 * client/src/pages/events.tsx
 * ─────────────────────────────
 * Upcoming one-off nights (theme nights, karaoke championships, live acts) —
 * distinct from the bookable function room. Admin-managed via Admin > Events.
 */

import { useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { applySeo, breadcrumb } from "@/lib/seo";
import { ArrowRight, Calendar, Clock, Mic2 } from "lucide-react";
import config from "@/lib/tenant";
import type { Event } from "@shared/schema";

const { brand } = config;

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export default function Events() {
  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/public/events"],
  });

  useEffect(() => {
    applySeo({
      title: `Events · ${brand.name}`,
      description: `What's on at ${brand.name} — theme nights, karaoke specials and live events in Newcastle.`,
      path: "/events",
      jsonLd: [breadcrumb([{ name: "Home", path: "/" }, { name: "Events", path: "/events" }])],
    });
  }, []);

  return (
    <SiteShell>
      <section className="bg-gradient-to-br from-muted to-background pt-12 sm:pt-20 pb-10 sm:pb-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p className="text-xs uppercase tracking-[0.28em] text-primary font-bold">What's on</p>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight mt-3 leading-[1.05] max-w-3xl">
            Upcoming <span className="font-serif accent-italic font-medium text-primary">events</span>.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Theme nights, karaoke specials and live events at {brand.name}. Want the room for a private night instead?{" "}
            <Link href="/book" className="text-primary font-semibold hover:underline">Book it here</Link>.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-md border border-dashed border-card-border bg-card p-10 text-center">
              <Mic2 className="size-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-display font-bold text-lg">Nothing on the calendar just yet</p>
              <p className="text-muted-foreground text-sm mt-1.5">Check back soon, or follow us for announcements.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="rounded-md border border-card-border bg-card shadow-sm overflow-hidden sm:flex">
                  {event.imageUrl && (
                    <div className="sm:w-48 shrink-0">
                      <img src={event.imageUrl} alt={event.title} className="w-full h-40 sm:h-full object-cover" loading="lazy" />
                    </div>
                  )}
                  <div className="p-5 sm:p-6 flex-1">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs uppercase tracking-wider font-semibold text-primary">
                      <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5" /> {formatEventDate(event.date)}</span>
                      {event.startTime && (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Clock className="size-3.5" /> {event.startTime}</span>
                      )}
                    </div>
                    <h2 className="font-display font-bold text-xl sm:text-2xl text-foreground mt-2">{event.title}</h2>
                    {event.description && (
                      <p className="text-sm sm:text-base text-muted-foreground mt-2 leading-relaxed">{event.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-16 sm:py-20 bg-[hsl(var(--sidebar))] text-white text-center">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight">
            Want the room to yourself?
          </h2>
          <p className="text-white/80 mt-3 text-base">
            Skip the calendar and book an exclusive night for your own crowd.
          </p>
          <Link href="/book">
            <Button size="lg" className="rounded-full px-8 py-6 mt-7 text-base font-semibold shadow-xl">
              Book the room <ArrowRight className="size-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
