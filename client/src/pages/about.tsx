/**
 * client/src/pages/about.tsx
 * ───────────────────────────
 * About the owner / groomer page. All copy, names, and contact info are driven
 * by tenant.config.ts.
 */

import { useEffect } from "react";
import { Link } from "wouter";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { applySeo, breadcrumb } from "@/lib/seo";
import { ArrowRight, Heart, Award, Users, Sparkles } from "lucide-react";
import config from "@/lib/tenant";
import { useContent } from "@/lib/content";
import { useBrand } from "@/lib/brand";

const { copy, business, brand } = config;

export default function About() {
  const { c } = useContent();
  const b = useBrand();
  const aboutTitle = c("about.title", copy.aboutTitle);
  const aboutBody = c("about.body", copy.aboutBody);
  const aboutImage = c("about.image", "/img/photos/about.jpg");

  useEffect(() => {
    applySeo({
      title: `About ${b.ownerName} · ${b.brandName} ${business.address.city}`,
      description: `${b.ownerName} runs ${b.brandName}, an in-home dog grooming service in ${business.address.city} and the wider Northumberland area. Calm, one-to-one grooming at your door.`,
      path: "/about",
      jsonLd: [
        breadcrumb([{ name: "Home", path: "/" }, { name: "About", path: "/about" }]),
        {
          "@context": "https://schema.org",
          "@type": "Person",
          name: b.ownerName,
          jobTitle: "Dog Groomer",
          worksFor: { "@type": "LocalBusiness", name: b.brandName },
          address: {
            "@type": "PostalAddress",
            addressLocality: business.address.city,
            addressCountry: "GB",
          },
        },
      ],
    });
  }, []);

  const aboutParagraphs = aboutBody.split("\n\n").filter(Boolean);
  const firstName = b.ownerName.split(" ")[0];

  return (
    <SiteShell>
      <section className="pt-12 sm:pt-20 pb-10 bg-gradient-to-br from-[hsl(35_40%_97%)] to-[hsl(35_40%_92%)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          <div className="lg:col-span-7">
            <p className="text-xs uppercase tracking-[0.28em] text-primary font-bold">About the groomer</p>
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight mt-3 leading-[1.05]">
              {aboutTitle.includes(firstName) ? (
                <>
                  {aboutTitle.split(firstName)[0]}
                  <span className="font-serif italic font-medium text-primary">{firstName}</span>
                  {aboutTitle.split(firstName)[1]}
                </>
              ) : (
                aboutTitle
              )}
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
                  Book with {firstName} <ArrowRight className="size-4 ml-1.5" />
                </Button>
              </Link>
              <Link href="/services">
                <Button size="lg" variant="outline" className="rounded-full px-7 py-6 text-base">
                  See services
                </Button>
              </Link>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="relative">
              <div className="absolute -inset-4 bg-primary/15 rounded-3xl blur-2xl" />
              {aboutImage && aboutImage !== "/img/photos/about.jpg" ? (
                <img
                  src={aboutImage}
                  alt={`${firstName} from ${b.brandName}`}
                  className="relative rounded-2xl shadow-2xl w-full aspect-[4/5] object-cover"
                  loading="eager"
                />
              ) : (
                <div className="relative rounded-2xl shadow-2xl w-full aspect-[4/5] bg-gradient-to-br from-primary/30 via-accent/15 to-primary/40 flex items-center justify-center overflow-hidden">
                  <svg className="size-32 text-white/40" viewBox="0 0 64 64" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="18" cy="22" rx="5.5" ry="7" />
                    <ellipse cx="30" cy="15" rx="5.5" ry="7" />
                    <ellipse cx="42" cy="15" rx="5.5" ry="7" />
                    <ellipse cx="54" cy="22" rx="5.5" ry="7" />
                    <path d="M36 28c-9 0-17 6.5-17 16 0 5.5 4 9 9 9 3 0 5-1.5 8-1.5s5 1.5 8 1.5c5 0 9-3.5 9-9 0-9.5-8-16-17-16z" />
                  </svg>
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-transparent to-transparent" />
                  <p className="absolute bottom-6 left-6 right-6 text-white font-display font-bold text-xl leading-tight">{firstName}<br/><span className="text-sm font-serif italic font-normal text-white/85">{b.brandName}</span></p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <p className="text-xs uppercase tracking-[0.28em] text-primary font-bold">What I stand for</p>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-tight mt-3 leading-tight">
              Calm care, proper grooming.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Heart, title: "Calm & one-to-one", body: "Every appointment is just me and your dog — no cages, no waiting around, no other dogs barking." },
              { icon: Award, title: "Trained & insured", body: "Professional grooming, safe handling and fully insured appointments for peace of mind." },
              { icon: Users, title: "In-home & convenient", body: "Travels to you and provides an in-home service, so your dog stays in familiar surroundings and you avoid the stress of travel." },
              { icon: Sparkles, title: "Tailored to the coat", body: "From bath and tidy appointments to full grooms and deshedding, every dog gets the right service for their coat, age and temperament." },
            ].map((v) => (
              <div key={v.title} className="bg-card border border-card-border rounded-2xl p-6 hover-elevate">
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

      <section className="py-16 sm:py-24 bg-[hsl(35_40%_94%)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <p className="text-xs uppercase tracking-[0.28em] text-primary font-bold text-center">My story</p>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight mt-3 text-center leading-tight">
            From a love of dogs <br className="hidden sm:block" /> to {b.brandShortName}.
          </h2>
          <div className="mt-10 prose prose-lg max-w-none font-body text-foreground/80 leading-relaxed space-y-5">
            {aboutParagraphs.slice(2).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <p className="font-serif italic text-primary text-xl mt-6">— {firstName}</p>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 bg-background text-center">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight">Ready to book a calm groom?</h2>
          <p className="text-muted-foreground mt-3 text-base">
            Book a service or message me first if you want to talk through your dog's coat, age or temperament.
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
