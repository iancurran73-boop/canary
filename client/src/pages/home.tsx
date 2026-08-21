/**
 * client/src/pages/home.tsx
 * ──────────────────────────
 * Homepage. Hero, highlights, booking CTA, testimonials.
 * All copy and contact details are driven by tenant.config.ts.
 */

import { useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Star, MapPin, Mic2, PartyPopper, Users } from "lucide-react";
import { applySeo, localBusinessJsonLd, breadcrumb } from "@/lib/seo";
import config from "@/lib/tenant";
import { useContent } from "@/lib/content";
import { useBrand } from "@/lib/brand";
import type { Review } from "@shared/schema";

// Resolve public-folder photos against Vite's BASE_URL so paths work both
// locally (served at /) and when deployed under a proxy subpath.
const BASE = import.meta.env.BASE_URL || "./";
const HERO_IMG = `${BASE}img/photos/venue.jpg`;

const HIGHLIGHTS = [
  {
    title: "Exclusively Yours",
    body: "Once you've booked, the room is yours for the whole session — no sharing the mic, no queuing for a slot.",
    icon: Users,
  },
  {
    title: "Full Karaoke Setup",
    body: "Proper sound system, big screen and thousands of songs to choose from. You bring the crowd, we bring the atmosphere.",
    icon: Mic2,
  },
  {
    title: "Any Occasion",
    body: "Birthdays, hen dos, work parties, or just because — the room works for whatever you're celebrating.",
    icon: PartyPopper,
  },
  {
    title: "Newcastle's Home of Karaoke",
    body: "A neon-lit corner pub in the heart of Newcastle. Come for the singing, stay for the good times.",
    icon: MapPin,
  },
];


const { copy, business, brand } = config;

export default function Home() {
  const { c } = useContent();
  const b = useBrand();
  const { data: reviews = [] } = useQuery<Review[]>({
    queryKey: ["/api/public/reviews"],
  });

  // Resolved content values — fall back to tenant config
  const heroTitle = c("home.heroTitle", copy.heroTitle);
  const heroBody = c("home.heroBody", copy.heroSubtitle);
  const heroImage = c("home.heroImage", HERO_IMG);
  const bullets = c("home.bullets", copy.homeBullets.join("\n"))
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean);

  useEffect(() => {
    applySeo({
      title: config.seo.defaultTitle,
      description: config.seo.defaultDescription,
      path: "/",
      image: HERO_IMG,
      jsonLd: [
        localBusinessJsonLd,
        breadcrumb([{ name: "Home", path: "/" }]),
      ],
    });
  }, []);

  return (
    <SiteShell>
      {/* HERO */}
      <section className="relative overflow-hidden bg-[hsl(var(--foreground))]">
        {/* Background — image if uploaded via Content tab, otherwise branded gradient */}
        <div className="absolute inset-0 z-0">
          {heroImage && heroImage !== HERO_IMG ? (
            <img
              src={heroImage}
              alt={`${b.brandName} hero`}
              className="absolute inset-0 w-full h-full object-cover"
              loading="eager"
              fetchPriority="high"
            />
          ) : (
            <img
              src={HERO_IMG}
              alt={`${b.brandName} hero`}
              className="absolute inset-0 w-full h-full object-cover"
              loading="eager"
              fetchPriority="high"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/15" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 lg:pt-24 pb-16 sm:pb-24 lg:pb-32 grid lg:grid-cols-12 gap-8 items-end min-h-[78vh] sm:min-h-[82vh]">
          <div className="lg:col-span-8 text-white">
            <p className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs uppercase tracking-[0.24em] font-semibold bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full mb-5 ring-1 ring-white/20">
              <Sparkles className="size-3 text-accent neon-flicker" /> Now booking · {business.address.city}
            </p>
            <h1 className="font-display font-extrabold tracking-tight leading-[0.95] text-[clamp(2.75rem,8vw,6rem)]">
              {heroTitle.split(" ").slice(0, -2).join(" ")}{" "}
              <span className="font-serif accent-italic font-medium text-accent">
                {heroTitle.split(" ").slice(-2).join(" ")}
              </span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-white/85 max-w-xl leading-relaxed">
              {heroBody}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/book">
                <Button size="lg" className="rounded-full px-8 py-6 text-base font-semibold shadow-xl">
                  Book the room <ArrowRight className="size-4 ml-1.5" />
                </Button>
              </Link>
              <Link href="/how-it-works">
                <Button size="lg" variant="outline" className="rounded-full px-7 py-6 text-base font-medium bg-white/10 hover:bg-white/20 border-white/30 text-white">
                  How it works
                </Button>
              </Link>
            </div>
          </div>

          {/* Floating ticket-stub card — fills the negative space with something
              specific to the room, instead of leaving it empty background. */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="ml-auto max-w-[260px] -rotate-2 bg-card/95 backdrop-blur border border-card-border shadow-2xl p-5">
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-bold">Admit one crowd</p>
              <p className="font-display text-2xl font-extrabold text-primary mt-1">Exclusive Room</p>
              <div className="border-t border-dashed border-card-border my-3" />
              <div className="space-y-1.5 text-xs text-foreground/85">
                <div className="flex justify-between"><span className="text-muted-foreground">Deposit</span><span className="font-semibold">£150</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Refund</span><span className="font-semibold">Bar tab</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Nights</span><span className="font-semibold">Thu–Sat</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE TICKER */}
      <div className="bg-accent text-accent-foreground py-2.5 overflow-hidden border-y border-accent/30">
        <div className="flex whitespace-nowrap font-display font-bold uppercase tracking-[0.2em] text-xs sm:text-sm marquee-track">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 pr-6 shrink-0">
              {["Karaoke", "Birthdays", "Hen Dos", "Work Parties", "Live Mic", "Singing", "Dancing", "Good Times"].map((tag) => (
                <span key={tag} className="flex items-center gap-6">
                  {tag} <span aria-hidden="true">★</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* WELCOME */}
      <section className="py-16 sm:py-24 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-primary font-bold">Welcome to {b.brandName}</p>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tight mt-3 leading-tight">
            Grab the mic, <span className="font-serif accent-italic font-medium text-primary">own the night</span>
          </h2>
          <p className="mt-4 font-display font-bold text-xl sm:text-2xl text-secondary">Singing · Dancing · Good Times</p>
          <div className="mt-6 max-w-3xl mx-auto space-y-4 text-lg text-muted-foreground leading-relaxed">
            <p>{b.brandName} is Newcastle's home of karaoke — a neon-lit corner pub where the mic is always live.</p>
            <p>Our private function room is exclusively yours once booked — no sharing the stage, no queuing for a slot.</p>
            <p>Just you, your crowd, and a room built for singing your heart out.</p>
          </div>
        </div>
      </section>

      {/* HIGHLIGHTS */}
      <section className="py-16 sm:py-24 bg-accent text-accent-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-xs uppercase tracking-[0.28em] font-bold">Why book with us</p>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tight mt-3 leading-tight">
              A night built for <span className="font-serif accent-italic font-medium text-primary">your crowd</span>.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {HIGHLIGHTS.map((h) => {
              const Icon = h.icon;
              return (
                <article key={h.title} className="bg-background text-foreground rounded-md overflow-hidden shadow-md flex flex-col">
                  <div className="p-6 sm:p-7 flex-1 flex flex-col">
                    <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <Icon className="size-6 text-primary" />
                    </div>
                    <h3 className="font-display font-extrabold text-lg sm:text-xl leading-tight text-primary">{h.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">{h.body}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-10 text-center">
            <Link href="/how-it-works">
              <Button size="lg" className="rounded-full px-7 py-6 text-base font-semibold shadow-xl">
                See how booking works <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* BOOKING CTA */}
      <section className="bg-[hsl(var(--sidebar))] text-white py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-accent font-bold">Book online</p>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tight mt-3 leading-tight">
              Reserve your night in <span className="font-serif accent-italic font-medium text-accent">under 60 seconds</span>.
            </h2>
            <p className="mt-5 text-white/80 text-lg leading-relaxed max-w-lg">
              Pick a date, tell us the occasion — your room is locked in with a £150 deposit.{" "}
              {b.ownerName} gets notified instantly and you'll have everything confirmed by email.
            </p>
            <ul className="mt-7 space-y-3 text-sm sm:text-base">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <span className="mt-1 size-2 rounded-full bg-accent shrink-0" />
                  <span className="text-white/90">{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/book">
                <Button size="lg" className="rounded-full px-7 py-6 text-base font-semibold bg-primary hover:bg-primary/90 shadow-xl">
                  Book the room <ArrowRight className="size-4 ml-1.5" />
                </Button>
              </Link>
              <a href={`tel:${b.phone}`}>
                <Button size="lg" variant="outline" className="rounded-full px-7 py-6 text-base bg-white/10 hover:bg-white/20 border-white/30 text-white">
                  Or call {b.phone}
                </Button>
              </a>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-3 bg-accent/20 rounded-md blur-2xl" />
            <div className="relative rounded-md shadow-2xl w-full aspect-[4/3] bg-gradient-to-br from-primary/40 via-accent/15 to-primary/50 flex flex-col items-center justify-center overflow-hidden p-8">
              <Mic2 className="size-24 text-white/40" strokeWidth={1.2} />
              <p className="mt-4 text-white font-display font-bold text-xl text-center">Grab the mic</p>
              <p className="text-white/80 font-serif accent-italic text-sm text-center">at {b.brandName}</p>
            </div>
            <div className="absolute -bottom-5 -left-5 sm:-left-8 bg-card text-foreground rounded-xl p-4 shadow-xl flex items-center gap-3">
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Find us</p>
                <p className="font-display font-bold text-sm">{business.address.line1}, {business.address.city}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS — only shown if reviews exist in the DB */}
      {reviews.length > 0 && (
        <section className="py-16 sm:py-24 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
              <p className="text-xs uppercase tracking-[0.28em] text-primary font-bold">Crowd favourite</p>
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tight mt-3 leading-tight">
                What people are saying.
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
              {reviews.map((r) => (
                <figure key={r.id} className="bg-card border border-card-border rounded-md p-6 sm:p-7 shadow-sm">
                  <div className="flex gap-0.5 text-accent mb-4">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star key={i} className="size-4 fill-accent" />
                    ))}
                  </div>
                  <blockquote className="font-serif accent-italic text-lg leading-relaxed text-foreground/85">
                    "{r.body}"
                  </blockquote>
                  <figcaption className="mt-5 pt-5 border-t border-card-border">
                    <p className="font-display font-bold text-sm">{r.authorName}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}
    </SiteShell>
  );
}
