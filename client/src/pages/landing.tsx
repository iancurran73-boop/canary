import { Link } from "wouter";
import { BookingWidget } from "@/components/booking-widget";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Sparkles, Heart, Shield, Smartphone } from "lucide-react";
import config from "@/lib/tenant";
import { useBrand } from "@/lib/brand";

const { brand, business } = config;

const scrollTo = (id: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

export default function Landing() {
  const b = useBrand();
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-foreground text-background text-center py-2 text-xs font-medium">
        Prototype preview · This is what will sit on {brand.domain} · <Link href="/admin" className="underline">View {business.ownerName}'s admin app →</Link>
      </div>

      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark className="h-20 sm:h-24 w-auto" />
            <div className="hidden sm:block">
              <div className="font-display font-bold text-foreground leading-tight text-lg">{brand.name}</div>
              <div className="text-xs text-muted-foreground italic">{brand.tagline}</div>
            </div>
          </div>
          <nav className="flex items-center gap-1 sm:gap-3">
            <a href="#about" onClick={scrollTo("about")} className="hidden sm:inline text-sm text-foreground/70 hover:text-foreground px-3 py-2 rounded-md hover-elevate">About</a>
            <a href="#services" onClick={scrollTo("services")} className="hidden sm:inline text-sm text-foreground/70 hover:text-foreground px-3 py-2 rounded-md hover-elevate">Services</a>
            <a href="#book" onClick={scrollTo("book")} className="hidden sm:inline text-sm text-foreground/70 hover:text-foreground px-3 py-2 rounded-md hover-elevate">Book</a>
            <Button variant="default" size="sm" onClick={scrollTo("book")} data-testid="button-book-header">
              Book now
            </Button>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-[hsl(338_70%_45%)]">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px)", backgroundSize: "40px 40px, 60px 60px" }} />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="text-primary-foreground">
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] font-semibold bg-white/15 backdrop-blur px-3 py-1 rounded-full mb-5">
              <Sparkles className="size-3" /> Now booking
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight">
              {brand.tagline.split("pampered perfection")[0]}
              <span className="font-serif italic font-medium">pampered perfection</span>
              {brand.tagline.includes("pampered perfection") ? "" : ` with ${brand.name}`}
            </h1>
            <p className="mt-5 text-lg text-primary-foreground/90 max-w-md">
              In-home dog grooming across {business.address.city} and Northumberland. Gentle, one-to-one appointments at your door.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" variant="secondary" onClick={scrollTo("book")} data-testid="button-book-hero">
                Book an appointment
              </Button>
              <Button size="lg" variant="outline" className="bg-white/10 border-white/30 text-primary-foreground hover:bg-white/20" onClick={scrollTo("services")} data-testid="button-services-hero">
                View services
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-primary-foreground/85">
              <span className="flex items-center gap-1.5"><Shield className="size-3.5" /> Secure online booking</span>
              <span className="flex items-center gap-1.5"><Heart className="size-3.5" /> Calm one-to-one care</span>
              <span className="flex items-center gap-1.5"><Smartphone className="size-3.5" /> Mobile-friendly</span>
            </div>
          </div>

          <div className="lg:pl-6">
            <div id="book" className="scroll-mt-24">
              <BookingWidget />
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="py-16 sm:py-20 bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">Services</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2 text-foreground">Simple services, calm appointments, clear pricing.</h2>
            <p className="text-muted-foreground mt-3">{business.ownerName} keeps these up to date from the admin app — change a price or duration once and the booking widget reflects it instantly.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mt-10">
            {[
              { t: "Full Groom", d: "bath, dry, cut, brush, nails, finish" },
              { t: "Bath & Tidy", d: "gentle bath, blow dry, brush, light tidy" },
              { t: "Bath & Deshed", d: "deep bath, deshedding treatment for double coats" },
              { t: "Add-ons", d: "nail clipping or feet trim, £10 each" },
            ].map((c) => (
              <div key={c.t} className="rounded-xl bg-card border border-card-border p-5 hover-elevate">
                <h3 className="font-display font-bold text-lg text-foreground">{c.t}</h3>
                <p className="text-sm text-muted-foreground mt-1 capitalize-first">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="py-16 sm:py-20 bg-secondary/5 border-y border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-secondary font-semibold">About {brand.name}</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2 text-foreground">A calmer way to keep dogs looking their best.</h2>
          <p className="font-serif italic text-lg text-foreground/80 mt-5 leading-relaxed">
            "I started Sophie's Pampered Paws because every dog deserves a calm, stress-free grooming experience. Bringing the salon to your door means no kennels, no waiting, no other dogs — just one happy pup at a time."
          </p>
          <p className="mt-6 text-sm text-muted-foreground">— {business.ownerName}, Owner & Groomer</p>
        </div>
      </section>

      <footer className="bg-sidebar text-sidebar-foreground py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid sm:grid-cols-3 gap-6 text-sm">
          <div>
            <BrandMark className="h-20 w-auto mb-3" />
            <p className="text-sidebar-foreground/70 text-xs">{brand.tagline}</p>
          </div>
          <div>
            <h4 className="font-display font-bold mb-2">Service area</h4>
            <p className="text-sidebar-foreground/70 text-xs">In-home across {business.address.city}<br />and the wider Northumberland area</p>
          </div>
          <div>
            <h4 className="font-display font-bold mb-2">Contact</h4>
            <p className="text-sidebar-foreground/70 text-xs">
              <a href={`tel:${b.phone}`} className="hover:text-sidebar-foreground">{b.phone}</a><br />
              <a href={`mailto:${b.email}`} className="hover:text-sidebar-foreground">{b.email}</a>
            </p>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-sidebar-border max-w-6xl mx-auto px-4 sm:px-6 text-xs text-sidebar-foreground/50 flex justify-between">
          <span>© {brand.name}</span>
          <Link href="/admin" className="hover:text-sidebar-foreground" data-testid="link-admin-footer">Booking admin</Link>
        </div>
      </footer>

      <style>{`.capitalize-first::first-letter { text-transform: uppercase; }`}</style>
    </div>
  );
}
