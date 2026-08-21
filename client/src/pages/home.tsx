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
import { Sparkles, Heart, Shield, Calendar, ArrowRight, Star, MapPin, Scissors, Dog, Home as HomeIcon, Map } from "lucide-react";
import { applySeo, localBusinessJsonLd, breadcrumb } from "@/lib/seo";
import config from "@/lib/tenant";
import { useContent, useGalleryItems } from "@/lib/content";
import { useBrand } from "@/lib/brand";
import type { Review } from "@shared/schema";

// Resolve public-folder photos against Vite's BASE_URL so paths work both
// locally (served at /) and when deployed under a proxy subpath.
const BASE = import.meta.env.BASE_URL || "./";
const HERO_IMG = `${BASE}img/photos/hero.jpg`;
const ABOUT_IMG = `${BASE}img/photos/about.jpg`;

const HIGHLIGHTS = [
  {
    title: "In-Home Grooming",
    body: "I come to you in a fully-fitted setup, so your dog never has to leave the comfort of home. No cages, no waiting around with other dogs.",
    icon: HomeIcon,
  },
  {
    title: "Calm & One-to-One",
    body: "Every appointment is just me and your dog. Gentle handling, plenty of treats and time — perfect for puppies, nervous dogs and older pups.",
    icon: Heart,
  },
  {
    title: "All Sizes & Coats",
    body: "From a Yorkie tidy to a Newfie de-shed. Hand stripping, scissor finishes, breed-standard or pet trims — whatever suits your dog best.",
    icon: Scissors,
  },
  {
    title: "Cramlington & Northumberland",
    body: "Covering Cramlington and the surrounding Northumberland villages. Drop your postcode in your booking and I'll confirm I can reach you.",
    icon: Map,
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
            <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--foreground))] via-primary/40 to-accent/30" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/15" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 lg:pt-24 pb-16 sm:pb-24 lg:pb-32 grid lg:grid-cols-12 gap-8 items-end min-h-[78vh] sm:min-h-[82vh]">
          <div className="lg:col-span-7 text-white">
            <p className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs uppercase tracking-[0.24em] font-semibold bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full mb-5 ring-1 ring-white/20">
              <Sparkles className="size-3 text-accent" /> Now booking · {business.address.city}
            </p>
            <h1 className="font-display font-extrabold tracking-tight leading-[1.02] text-[clamp(2.5rem,7vw,5rem)]">
              {heroTitle.split(" ").slice(0, -2).join(" ")}{" "}
              <span className="font-serif italic font-medium text-accent">
                {heroTitle.split(" ").slice(-2).join(" ")}
              </span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-white/85 max-w-xl leading-relaxed">
              {heroBody}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/book">
                <Button size="lg" className="rounded-full px-7 py-6 text-base font-semibold shadow-xl">
                  Book your appointment <ArrowRight className="size-4 ml-1.5" />
                </Button>
              </Link>
              <Link href="/services">
                <Button size="lg" variant="outline" className="rounded-full px-7 py-6 text-base font-medium bg-white/10 hover:bg-white/20 border-white/30 text-white">
                  See price list
                </Button>
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm text-white/80">
              <span className="inline-flex items-center gap-1.5"><MapPin className="size-4 text-accent" /> In-home — I come to you</span>
              <span className="inline-flex items-center gap-1.5"><Heart className="size-4 text-accent" /> Calm, one-to-one grooming</span>
              <span className="inline-flex items-center gap-1.5"><Calendar className="size-4 text-accent" /> Online booking · 24/7</span>
            </div>
          </div>
        </div>

        {/* Brand strip */}
        <div className="bg-accent text-accent-foreground py-3 overflow-hidden">
          <div className="flex gap-12 animate-[scroll_40s_linear_infinite] whitespace-nowrap text-sm font-display font-bold uppercase tracking-[0.2em]">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-12">
                {config.services.filter(s => s.active).slice(0, 6).map((s) => (
                  <span key={s.id}>{s.name}</span>
                ))}
                <span>·</span>
                <span>{business.address.city} · {business.address.postcode}</span>
                <span>·</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WELCOME */}
      <section className="py-16 sm:py-24 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-primary font-bold">Welcome to {b.brandName}</p>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tight mt-3 leading-tight">
            Grooming that comes to <span className="font-serif italic font-medium text-primary">your door</span>
          </h2>
          <p className="mt-4 font-display font-bold text-xl sm:text-2xl text-secondary">Calm, one-to-one, on your doorstep</p>
          <div className="mt-6 max-w-3xl mx-auto space-y-4 text-lg text-muted-foreground leading-relaxed">
            <p>At {b.brandName}, every dog gets my full attention — no cages, no kennels, no other dogs barking.</p>
            <p>I bring a fully-fitted grooming setup right to your home, so your dog stays relaxed throughout.</p>
            <p>It's especially good for puppies on their first groom, nervous dogs, and older pups who don't travel well.</p>
            <p>Bath, blow-dry, clip, scissor finish, nails, ears — whatever your dog needs.</p>
          </div>
        </div>
      </section>

      {/* HIGHLIGHTS */}
      <section className="py-16 sm:py-24 bg-accent text-accent-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-xs uppercase tracking-[0.28em] font-bold">Our Highlights</p>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tight mt-3 leading-tight">
              A little <span className="font-serif italic font-medium text-primary">spa day</span> for every pup.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {HIGHLIGHTS.map((h) => {
              const Icon = h.icon;
              return (
                <article key={h.title} className="bg-background text-foreground rounded-2xl overflow-hidden shadow-md flex flex-col">
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
            <Link href="/services">
              <Button size="lg" className="rounded-full px-7 py-6 text-base font-semibold shadow-xl">
                See full price list <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* BOOKING CTA */}
      <section className="bg-foreground text-white py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-accent font-bold">Book online</p>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tight mt-3 leading-tight">
              Reserve your slot in <span className="font-serif italic font-medium text-accent">under 60 seconds</span>.
            </h2>
            <p className="mt-5 text-white/80 text-lg leading-relaxed max-w-lg">
              Pick your service, choose a time — your slot is locked, pay on the day.{" "}
              {b.ownerName} gets notified instantly and you'll have everything in your calendar.
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
                  Book your appointment <ArrowRight className="size-4 ml-1.5" />
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
            <div className="absolute -inset-3 bg-accent/20 rounded-3xl blur-2xl" />
            <div className="relative rounded-2xl shadow-2xl w-full aspect-[4/3] bg-gradient-to-br from-primary/40 via-accent/15 to-primary/50 flex flex-col items-center justify-center overflow-hidden p-8">
              <Dog className="size-24 text-white/40" strokeWidth={1.2} />
              <p className="mt-4 text-white font-display font-bold text-xl text-center">{b.ownerName}</p>
              <p className="text-white/80 font-serif italic text-sm text-center">at {b.brandName}</p>
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
              <p className="text-xs uppercase tracking-[0.28em] text-primary font-bold">Client love</p>
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tight mt-3 leading-tight">
                Tails (and tales) from happy clients.
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
              {reviews.map((r) => (
                <figure key={r.id} className="bg-card border border-card-border rounded-2xl p-6 sm:p-7 shadow-sm">
                  <div className="flex gap-0.5 text-accent mb-4">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star key={i} className="size-4 fill-accent" />
                    ))}
                  </div>
                  <blockquote className="font-serif italic text-lg leading-relaxed text-foreground/85">
                    "{r.body}"
                  </blockquote>
                  <figcaption className="mt-5 pt-5 border-t border-card-border">
                    <p className="font-display font-bold text-sm">{r.authorName}</p>
                    {r.dogName && <p className="text-xs text-muted-foreground">{r.dogName}</p>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      <style>{`
        @keyframes scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-33.333%); }
        }
      `}</style>
    </SiteShell>
  );
}
