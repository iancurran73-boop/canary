/**
 * client/src/pages/services.tsx
 * ──────────────────────────────
 * Services & price list page. Service data driven by config.services.
 * Categories are derived automatically from the services list.
 * Price poster images (if present) are still read from the public folder.
 */

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { applySeo, breadcrumb } from "@/lib/seo";
import { ArrowRight, Clock, Heart, Sparkles, X } from "lucide-react";
import config from "@/lib/tenant";

const BASE = import.meta.env.BASE_URL || "./";
const { services: allServices, brand, business, payments } = config;

const SERVICES = allServices.filter((s) => s.active).sort((a, b) => a.sortOrder - b.sortOrder);
const CATEGORIES = Array.from(new Set(SERVICES.map((s) => s.category)));

// Only show poster cards for services that have a real image URL uploaded.
// Otherwise the page shows broken-image placeholders.
const PRICE_POSTERS = SERVICES.slice(0, 7)
  .filter((s) => s.imageUrl && s.imageUrl.trim() !== "")
  .map((s) => ({
    src: s.imageUrl.startsWith("/") ? s.imageUrl : `${BASE}${s.imageUrl}`,
    title: `${s.name} — ${payments.currencySymbol}${s.fromPrice ? "from " : ""}${s.price}`,
    caption: s.description,
    featured: s.sortOrder === SERVICES[0].sortOrder,
  }));

export default function Services() {
  const [zoomed, setZoomed] = useState<number | null>(null);

  useEffect(() => {
    applySeo({
      title: `Services & Price List · ${brand.name} ${business.address.city}`,
      description: `Full price list at ${brand.name}. ${SERVICES.map((s) => `${s.name} ${payments.currencySymbol}${s.price}`).slice(0, 5).join(", ")} and more. Book online today.`,
      path: "/services",
      jsonLd: [
        breadcrumb([
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
        ]),
        {
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: SERVICES.map((s, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@type": "Service",
              name: s.name,
              description: s.description,
              provider: { "@type": "LocalBusiness", name: brand.name },
              areaServed: business.address.city,
              offers: {
                "@type": "Offer",
                price: String(s.price),
                priceCurrency: payments.currency,
              },
            },
          })),
        },
      ],
    });
  }, []);

  useEffect(() => {
    if (zoomed === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomed(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomed]);

  return (
    <SiteShell>
      <section className="bg-gradient-to-br from-[hsl(35_40%_97%)] to-[hsl(35_40%_92%)] pt-12 sm:pt-20 pb-10 sm:pb-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p className="text-xs uppercase tracking-[0.28em] text-primary font-bold">Price list</p>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight mt-3 leading-[1.05] max-w-4xl">
            Grooming services, <span className="font-serif italic font-medium text-primary">clearly priced</span>.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            In-home grooming with {brand.name}. Book online and pay on the day.
          </p>
        </div>
      </section>

      {PRICE_POSTERS.length > 0 && (
        <section className="py-10 sm:py-14 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setZoomed(0)}
              className="block w-full group rounded-3xl overflow-hidden bg-card border border-card-border shadow-md hover:shadow-xl transition-shadow text-left"
              data-testid="poster-main"
            >
              <div className="grid lg:grid-cols-12 items-stretch">
                <div className="lg:col-span-7 bg-muted">
                  <img
                    src={PRICE_POSTERS[0].src}
                    alt={PRICE_POSTERS[0].title}
                    className="w-full h-full object-contain max-h-[640px]"
                    loading="eager"
                  />
                </div>
                <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
                  <p className="text-xs uppercase tracking-[0.28em] text-primary font-bold">The price list</p>
                  <h2 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight mt-2 leading-tight">
                    {brand.shortName} Service Menu
                  </h2>
                  <p className="mt-4 text-muted-foreground leading-relaxed">
                    Full grooms, bath services and quick add-ons — clearly listed and easy to book online.
                  </p>
                  <p className="mt-4 text-sm text-foreground/70 italic font-serif">Tap to view full size.</p>
                </div>
              </div>
            </button>

            {PRICE_POSTERS.length > 1 && (
              <div className="mt-8 sm:mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {PRICE_POSTERS.slice(1).map((p, i) => (
                  <button
                    key={p.src}
                    type="button"
                    onClick={() => setZoomed(i + 1)}
                    className="group block text-left rounded-2xl overflow-hidden bg-card border border-card-border shadow-sm hover:shadow-lg transition-shadow"
                    data-testid={`poster-${i + 1}`}
                  >
                    <div className="aspect-[2/3] overflow-hidden bg-muted">
                      <img
                        src={p.src}
                        alt={p.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-4 sm:p-5">
                      <h3 className="font-display font-extrabold text-base sm:text-lg leading-tight text-primary">
                        {p.title}
                      </h3>
                      <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">{p.caption}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="py-12 sm:py-16 bg-[hsl(35_40%_97%)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <p className="text-xs uppercase tracking-[0.28em] text-primary font-bold">Full grooming menu</p>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tight mt-3 leading-tight">
              Pick your service &amp; book online.
            </h2>
            <p className="mt-4 text-base text-muted-foreground leading-relaxed">
              Every service below can be booked online — pay on the day.
            </p>
          </div>

          {CATEGORIES.map((cat) => {
            const items = SERVICES.filter((s) => s.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="mb-12 sm:mb-16 last:mb-0">
                <div className="flex items-end justify-between gap-6 mb-5 sm:mb-6">
                  <h3 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-secondary">
                    {cat}
                  </h3>
                  <div className="flex-1 border-b border-border mb-2" />
                </div>
                <div className="grid md:grid-cols-2 gap-5 sm:gap-6">
                  {items.map((s) => (
                    <article
                      key={s.id}
                      id={`service-${s.id}`}
                      className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                    >
                      <div className="flex items-start justify-between gap-4 p-5 sm:p-6 pb-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Sparkles className="size-5" />
                          </span>
                          <div className="min-w-0">
                            <h4 className="font-display font-extrabold text-lg sm:text-xl tracking-tight leading-snug">
                              {s.name}
                            </h4>
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-bold mt-1">
                              <Clock className="inline size-3 mr-1 -mt-0.5" />
                              {s.durationMinutes} min
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="px-5 sm:px-6 pb-5 sm:pb-6 flex-1 flex flex-col">
                        <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                        <div className="mt-5 pt-4 border-t border-border flex items-end justify-between gap-3">
                          <div>
                            {s.fromPrice && (
                              <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">From</p>
                            )}
                            <p className="font-display font-extrabold text-2xl text-primary leading-none">
                              {payments.currencySymbol}{s.price}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Pay on the day
                            </p>
                          </div>
                          <Link href="/book">
                            <Button size="sm" className="rounded-full px-4 font-semibold">
                              Book <ArrowRight className="size-3.5 ml-1" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid md:grid-cols-3 gap-6 text-sm">
          {[
            { icon: Clock, title: "Arrive relaxed", body: "Because I come to you, your dog can stay settled at home before the appointment starts." },
            { icon: Heart, title: "One-to-one care", body: "No cages, no noisy salon and no overlap with other dogs — just calm handling throughout." },
            { icon: Sparkles, title: "Need something specific?", body: `If you're unsure which groom is right, message ${business.ownerName} and I'll help you choose.` },
          ].map((n) => (
            <div key={n.title} className="bg-card border border-card-border rounded-2xl p-6">
              <n.icon className="size-5 text-primary" />
              <h3 className="font-display font-bold text-base mt-3">{n.title}</h3>
              <p className="text-muted-foreground mt-2 leading-relaxed">{n.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 sm:py-20 bg-[hsl(35_40%_97%)] text-center">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight">
            Ready to book your dog in?
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            Choose a service and time online — pay on the day, appointment secured.
          </p>
          <Link href="/book">
            <Button size="lg" className="rounded-full px-8 py-6 mt-7 text-base font-semibold shadow-xl">
              Book online <ArrowRight className="size-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </section>

      {zoomed !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 cursor-zoom-out"
          onClick={() => setZoomed(null)}
          role="dialog"
          aria-modal="true"
          aria-label={PRICE_POSTERS[zoomed]?.title}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoomed(null); }}
            className="absolute top-4 right-4 size-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label="Close"
            data-testid="button-close-poster"
          >
            <X className="size-6" />
          </button>
          <img
            src={PRICE_POSTERS[zoomed]?.src}
            alt={PRICE_POSTERS[zoomed]?.title}
            className="max-h-[90vh] max-w-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </SiteShell>
  );
}
