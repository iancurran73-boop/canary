/**
 * client/src/pages/how-it-works.tsx
 * ────────────────────────────────────
 * Explains the in-home grooming process step by step. Copy and step photos
 * are all admin-editable via the Content tab (howItWorks.* content keys),
 * falling back to tenant.config.ts defaults.
 */

import { useEffect } from "react";
import { Link } from "wouter";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { applySeo, breadcrumb } from "@/lib/seo";
import { ArrowRight, Home, Settings2, Droplets, Scissors, Plug, Sparkles, PawPrint } from "lucide-react";
import config from "@/lib/tenant";
import { useContent } from "@/lib/content";
import { useBrand } from "@/lib/brand";

const { copy, business } = config;

const STEP_ICONS = [Home, Settings2, Droplets, Scissors, Plug, Sparkles];

const PHOTO_SLOTS = [
  { key: "howItWorks.photo1", caption: "Getting set up" },
  { key: "howItWorks.photo2", caption: "Bath time" },
  { key: "howItWorks.photo3", caption: "All done" },
];

export default function HowItWorks() {
  const { c } = useContent();
  const b = useBrand();

  const title = c("howItWorks.title", copy.howItWorksTitle);
  const intro = c("howItWorks.intro", copy.howItWorksIntro);
  const stepsRaw = c("howItWorks.steps", copy.howItWorksSteps.join("\n"));
  const steps = stepsRaw.split("\n").map((s) => s.trim()).filter(Boolean);

  useEffect(() => {
    applySeo({
      title: `How It Works · ${b.brandName} ${business.address.city}`,
      description: `See exactly how ${b.brandName}'s in-home dog grooming works, from arrival to a clean, happy dog — no van, no salon, all in your own home.`,
      path: "/how-it-works",
      jsonLd: [breadcrumb([{ name: "Home", path: "/" }, { name: "How It Works", path: "/how-it-works" }])],
    });
  }, []);

  return (
    <SiteShell>
      <section className="pt-12 sm:pt-20 pb-10 sm:pb-14 bg-gradient-to-br from-[hsl(35_40%_97%)] to-[hsl(35_40%_92%)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-primary font-bold">How it works</p>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight mt-3 leading-[1.05]">
            {title}
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed">
            {intro}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/book">
              <Button size="lg" className="rounded-full px-7 py-6 text-base font-semibold">
                Book online <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </Link>
            <Link href="/services">
              <Button size="lg" variant="outline" className="rounded-full px-7 py-6 text-base">
                See services
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <ol className="space-y-6">
            {steps.map((step, i) => {
              const Icon = STEP_ICONS[i] ?? PawPrint;
              return (
                <li key={i} className="flex gap-5 sm:gap-6 items-start">
                  <div className="shrink-0 flex flex-col items-center">
                    <div className="size-11 sm:size-12 rounded-full bg-primary/10 text-primary grid place-items-center font-display font-extrabold text-lg">
                      {i + 1}
                    </div>
                    {i < steps.length - 1 && <div className="w-px flex-1 min-h-6 bg-border mt-2" />}
                  </div>
                  <div className="bg-card border border-card-border rounded-2xl p-5 sm:p-6 flex-1 flex items-start gap-4">
                    <div className="hidden sm:grid shrink-0 size-10 rounded-xl bg-primary/10 text-primary place-items-center">
                      <Icon className="size-5" />
                    </div>
                    <p className="text-base text-foreground/85 leading-relaxed">{step}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-[hsl(35_40%_94%)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <p className="text-xs uppercase tracking-[0.28em] text-primary font-bold">In your own home</p>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tight mt-3 leading-tight">
              See it in action.
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {PHOTO_SLOTS.map((slot) => {
              const url = c(slot.key, "");
              return (
                <div key={slot.key} className="rounded-2xl overflow-hidden border border-card-border shadow-sm bg-card">
                  {url ? (
                    <img src={url} alt={slot.caption} className="w-full aspect-[4/5] object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full aspect-[4/5] bg-gradient-to-br from-primary/25 via-accent/10 to-primary/35 flex items-center justify-center">
                      <PawPrint className="size-12 text-white/50" />
                    </div>
                  )}
                  <p className="text-center text-sm font-semibold py-3 text-foreground/80">{slot.caption}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 bg-background text-center">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight">Ready to book?</h2>
          <p className="text-muted-foreground mt-3 text-base">
            Pick a service and a time that suits you — {b.ownerName} gets notified straight away.
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
