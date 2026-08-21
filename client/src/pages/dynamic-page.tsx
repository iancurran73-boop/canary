/**
 * client/src/pages/dynamic-page.tsx
 * ────────────────────────────────────
 * Renders admin-created custom pages (Admin > Pages). Looks up the page by
 * slug, then renders the matching layout, reading its copy/photos from the
 * content table under "page.<slug>.<field>" keys — the same auto-saving
 * InlineText/ImageDropzone pattern used everywhere else on the site.
 */

import { useParams, Link } from "wouter";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { applySeo, breadcrumb } from "@/lib/seo";
import { useContent } from "@/lib/content";
import { useBrand } from "@/lib/brand";
import type { SitePage } from "@/lib/pages";
import type { Review } from "@shared/schema";
import { ArrowRight, Mic2, Calendar, Users, CreditCard, PartyPopper, Star } from "lucide-react";
import NotFound from "@/pages/not-found";

async function fetchPage(slug: string): Promise<SitePage | null> {
  const res = await fetch(`/api/public/pages/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("page fetch failed");
  return res.json();
}

const STEP_ICONS = [Calendar, Users, CreditCard, PartyPopper, Mic2];

function Hero({ title, intro }: { title: string; intro: string }) {
  return (
    <section className="pt-12 sm:pt-20 pb-10 sm:pb-14 bg-gradient-to-br from-muted to-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05]">{title}</h1>
        {intro && <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed">{intro}</p>}
      </div>
    </section>
  );
}

function CtaFooter() {
  return (
    <section className="py-16 sm:py-20 bg-background text-center">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <h2 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight">Ready to book?</h2>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/book"><Button size="lg" className="rounded-full px-8 py-6 text-base font-semibold">Book online</Button></Link>
          <Link href="/contact"><Button size="lg" variant="outline" className="rounded-full px-8 py-6 text-base">Get in touch</Button></Link>
        </div>
      </div>
    </section>
  );
}

function StepsLayout({ slug, title, intro }: { slug: string; title: string; intro: string }) {
  const { c } = useContent();
  const steps = c(`page.${slug}.steps`, "").split("\n").map((s) => s.trim()).filter(Boolean);
  const photos = [1, 2, 3].map((n) => c(`page.${slug}.photo${n}`, ""));

  return (
    <>
      <Hero title={title} intro={intro} />
      <section className="py-16 sm:py-24 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          {steps.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm">No steps added yet — add some in Admin &gt; Pages.</p>
          ) : (
            <ol className="space-y-6">
              {steps.map((step, i) => {
                const Icon = STEP_ICONS[i] ?? Mic2;
                return (
                  <li key={i} className="flex gap-5 sm:gap-6 items-start">
                    <div className="shrink-0 flex flex-col items-center">
                      <div className="size-11 sm:size-12 rounded-full bg-primary/10 text-primary grid place-items-center font-display font-extrabold text-lg">{i + 1}</div>
                      {i < steps.length - 1 && <div className="w-px flex-1 min-h-6 bg-border mt-2" />}
                    </div>
                    <div className="bg-card border border-card-border rounded-md p-5 sm:p-6 flex-1 flex items-start gap-4">
                      <div className="hidden sm:grid shrink-0 size-10 rounded-xl bg-primary/10 text-primary place-items-center"><Icon className="size-5" /></div>
                      <p className="text-base text-foreground/85 leading-relaxed">{step}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>
      {photos.some(Boolean) && (
        <section className="py-16 sm:py-24 bg-muted">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid sm:grid-cols-3 gap-5">
            {photos.filter(Boolean).map((url, i) => (
              <div key={i} className="rounded-md overflow-hidden border border-card-border shadow-sm bg-card">
                <img src={url} alt={title} className="w-full aspect-[4/5] object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        </section>
      )}
      <CtaFooter />
    </>
  );
}

function StoryLayout({ slug, title, intro }: { slug: string; title: string; intro: string }) {
  const { c } = useContent();
  const body = c(`page.${slug}.body`, "");
  const image = c(`page.${slug}.image`, "");
  const paragraphs = body.split("\n\n").filter(Boolean);

  return (
    <>
      <section className="pt-12 sm:pt-20 pb-10 bg-gradient-to-br from-muted to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          <div className={image ? "lg:col-span-7" : "lg:col-span-12 text-center"}>
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05]">{title}</h1>
            {intro && <p className="mt-5 text-lg text-muted-foreground leading-relaxed">{intro}</p>}
          </div>
          {image && (
            <div className="lg:col-span-5">
              <img src={image} alt={title} className="rounded-md shadow-2xl w-full aspect-[4/5] object-cover" loading="eager" />
            </div>
          )}
        </div>
      </section>
      {paragraphs.length > 0 && (
        <section className="py-16 sm:py-24 bg-background">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 prose prose-lg max-w-none font-body text-foreground/80 leading-relaxed space-y-5">
            {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </section>
      )}
      <CtaFooter />
    </>
  );
}

function SimpleLayout({ slug, title, intro }: { slug: string; title: string; intro: string }) {
  const { c } = useContent();
  const body = c(`page.${slug}.body`, "");
  const image = c(`page.${slug}.image`, "");

  return (
    <>
      <Hero title={title} intro={intro} />
      <section className="py-16 sm:py-20 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {image && <img src={image} alt={title} className="rounded-md shadow-lg w-full aspect-video object-cover mb-10" loading="eager" />}
          {body && <p className="text-base text-foreground/80 leading-relaxed whitespace-pre-line">{body}</p>}
        </div>
      </section>
      <CtaFooter />
    </>
  );
}

function GalleryLayout({ slug, title, intro }: { slug: string; title: string; intro: string }) {
  const { c } = useContent();
  const photos = [1, 2, 3, 4, 5, 6].map((n) => c(`page.${slug}.photo${n}`, "")).filter(Boolean);

  return (
    <>
      <Hero title={title} intro={intro} />
      <section className="py-16 sm:py-24 bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {photos.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm">No photos added yet — add some in Admin &gt; Pages.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {photos.map((url, i) => (
                <div key={i} className="rounded-md overflow-hidden border border-card-border shadow-sm bg-card">
                  <img src={url} alt={`${title} ${i + 1}`} className="w-full aspect-square object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      <CtaFooter />
    </>
  );
}

function FaqLayout({ slug, title, intro }: { slug: string; title: string; intro: string }) {
  const { c } = useContent();
  const raw = c(`page.${slug}.faq`, "");
  const items = raw
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [q, ...rest] = block.split("\n");
      return { q: q.trim(), a: rest.join(" ").trim() };
    })
    .filter((i) => i.q && i.a);

  return (
    <>
      <Hero title={title} intro={intro} />
      <section className="py-16 sm:py-24 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm">No questions added yet — add some in Admin &gt; Pages.</p>
          ) : (
            <Accordion type="single" collapsible className="space-y-3">
              {items.map((item, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border border-card-border rounded-xl overflow-hidden bg-card px-2">
                  <AccordionTrigger className="px-3 py-4 font-display font-bold text-left hover:no-underline">{item.q}</AccordionTrigger>
                  <AccordionContent className="px-3 pb-4 text-foreground/80 leading-relaxed">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </section>
      <CtaFooter />
    </>
  );
}

function TestimonialsLayout({ title, intro }: { title: string; intro: string }) {
  const { data: reviews = [] } = useQuery<Review[]>({ queryKey: ["/api/public/reviews"] });

  return (
    <>
      <Hero title={title} intro={intro} />
      <section className="py-16 sm:py-24 bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {reviews.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm">No reviews yet.</p>
          ) : (
            <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
              {reviews.map((r) => (
                <figure key={r.id} className="bg-card border border-card-border rounded-md p-6 sm:p-7 shadow-sm">
                  <div className="flex gap-0.5 text-accent mb-4">
                    {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="size-4 fill-accent" />)}
                  </div>
                  <blockquote className="font-serif accent-italic text-lg leading-relaxed text-foreground/85">"{r.body}"</blockquote>
                  <figcaption className="mt-5 pt-5 border-t border-card-border">
                    <p className="font-display font-bold text-sm">{r.authorName}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </section>
      <CtaFooter />
    </>
  );
}

function PromoLayout({ slug, title, intro }: { slug: string; title: string; intro: string }) {
  const { c } = useContent();
  const body = c(`page.${slug}.body`, "");
  const image = c(`page.${slug}.image`, "");

  return (
    <>
      <section
        className="pt-16 sm:pt-24 pb-16 sm:pb-24 bg-cover bg-center text-center relative"
        style={image ? { backgroundImage: `linear-gradient(hsl(240 30% 14% / 0.55), hsl(240 30% 14% / 0.55)), url(${image})`, color: "white" } : undefined}
      >
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.05]">{title}</h1>
          {intro && <p className="mt-5 text-lg leading-relaxed opacity-90">{intro}</p>}
          {body && <p className="mt-5 text-base leading-relaxed opacity-90 whitespace-pre-line">{body}</p>}
          <Link href="/book">
            <Button size="lg" className="rounded-full px-8 py-6 mt-8 text-base font-semibold shadow-xl">
              Book online <ArrowRight className="size-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}

export default function DynamicPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { c } = useContent();
  const b = useBrand();

  const { data: page, isSuccess } = useQuery<SitePage | null>({
    queryKey: ["/api/public/pages", slug],
    queryFn: () => fetchPage(slug),
  });

  const title = c(`page.${slug}.title`, page?.navLabel ?? "");
  const intro = c(`page.${slug}.intro`, "");

  useEffect(() => {
    if (!page) return;
    applySeo({
      title: `${page.navLabel} · ${b.brandName}`,
      description: intro || `${page.navLabel} — ${b.brandName}`,
      path: page.path,
      jsonLd: [breadcrumb([{ name: "Home", path: "/" }, { name: page.navLabel, path: page.path }])],
    });
  }, [page, intro]);

  if (isSuccess && !page) return <NotFound />;
  if (!page) return null;

  return (
    <SiteShell>
      {page.layout === "story" && <StoryLayout slug={slug} title={title} intro={intro} />}
      {page.layout === "simple" && <SimpleLayout slug={slug} title={title} intro={intro} />}
      {page.layout === "gallery" && <GalleryLayout slug={slug} title={title} intro={intro} />}
      {page.layout === "faq" && <FaqLayout slug={slug} title={title} intro={intro} />}
      {page.layout === "testimonials" && <TestimonialsLayout title={title} intro={intro} />}
      {page.layout === "promo" && <PromoLayout slug={slug} title={title} intro={intro} />}
      {(page.layout === "steps" || !page.layout) && <StepsLayout slug={slug} title={title} intro={intro} />}
    </SiteShell>
  );
}
