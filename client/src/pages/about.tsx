/**
 * client/src/pages/about.tsx
 * ───────────────────────────
 * About the venue. All copy and contact info are driven by tenant.config.ts.
 */

import { useEffect } from "react";
import { Link } from "wouter";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { applySeo, breadcrumb } from "@/lib/seo";
import { ArrowRight, Mic2, Users, PartyPopper, MapPin } from "lucide-react";
import config from "@/lib/tenant";
import { useContent } from "@/lib/content";
import { useBrand } from "@/lib/brand";
import { useNavLabel } from "@/lib/pages";

const { copy, business } = config;

export default function About() {
  const { c } = useContent();
  const b = useBrand();
  const howItWorksLabel = useNavLabel("how-it-works");
  const aboutTitle = c("about.title", copy.aboutTitle);
  const aboutBody = c("about.body", copy.aboutBody);
  const aboutImage = c("about.image", "/img/photos/venue.jpg");

  useEffect(() => {
    applySeo({
      title: `About ${b.brandName} · ${business.address.city}`,
      description: `${b.brandName} is Newcastle's home of karaoke — a private function room for birthdays, hen dos, work parties and more.`,
      path: "/about",
      jsonLd: [
        breadcrumb([{ name: "Home", path: "/" }, { name: "About", path: "/about" }]),
      ],
    });
  }, []);

  const aboutParagraphs = aboutBody.split("\n\n").filter(Boolean);

  return (
    <SiteShell>
      <section className="pt-12 sm:pt-20 pb-10 bg-gradient-to-br from-muted to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          <div className="lg:col-span-7">
            <p className="text-xs uppercase tracking-[0.28em] text-primary font-bold">About us</p>
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight mt-3 leading-[1.05]">
              {aboutTitle}
            </h1>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
              {aboutParagraphs[0]}
            </p>
            {aboutParagraphs[1] && (
              <p className="mt-4 text-base text-muted-foreground leading-relaxed">
                {aboutParagraphs[1]}
              </p>
            )}
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/book">
                <Button size="lg" className="rounded-full px-7 py-6 text-base font-semibold">
                  Book the room <ArrowRight className="size-4 ml-1.5" />
                </Button>
              </Link>
              <Link href="/how-it-works">
                <Button size="lg" variant="outline" className="rounded-full px-7 py-6 text-base">
                  {howItWorksLabel}
                </Button>
              </Link>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="relative">
              <div className="absolute -inset-4 bg-primary/15 rounded-md blur-2xl" />
              <img
                src={aboutImage}
                alt={b.brandName}
                className="relative rounded-md shadow-2xl w-full aspect-[4/5] object-cover"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <p className="text-xs uppercase tracking-[0.28em] text-primary font-bold">What we're about</p>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tight mt-3 leading-tight">
              Singing, dancing, good times.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Users, title: "Exclusively yours", body: "The room is booked exclusively for your session — no sharing the stage, no other groups." },
              { icon: Mic2, title: "Live mic, big screen", body: "Full karaoke setup with a proper sound system and thousands of songs to pick from." },
              { icon: PartyPopper, title: "Any occasion", body: "Birthdays, hen dos, work parties, or no reason at all — the room works for it." },
              { icon: MapPin, title: "Heart of Newcastle", body: "A neon-lit corner pub that's become the city's go-to for a proper night out." },
            ].map((v) => (
              <div key={v.title} className="bg-card border border-card-border rounded-md p-6 hover-elevate">
                <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <v.icon className="size-5" />
                </div>
                <h3 className="font-display font-bold text-lg mt-4">{v.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {aboutParagraphs.length > 2 && (
        <section className="py-16 sm:py-24 bg-muted">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <p className="text-xs uppercase tracking-[0.28em] text-primary font-bold text-center">Our story</p>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight mt-3 text-center leading-tight">
              {b.brandName}
            </h2>
            <div className="mt-10 prose prose-lg max-w-none font-body text-foreground/80 leading-relaxed space-y-5">
              {aboutParagraphs.slice(2).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-16 sm:py-20 bg-background text-center">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight">Ready to grab the mic?</h2>
          <p className="text-muted-foreground mt-3 text-base">
            Book the room online, or get in touch if you want to talk through your night first.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/book"><Button size="lg" className="rounded-full px-8 py-6 text-base font-semibold">Book online</Button></Link>
            <Link href="/contact"><Button size="lg" variant="outline" className="rounded-full px-8 py-6 text-base">Get in touch</Button></Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
