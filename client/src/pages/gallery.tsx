/**
 * client/src/pages/gallery.tsx
 * ─────────────────────────────
 * Photo gallery of the venue and past nights.
 * Primary data source: gallery_items table (via useGalleryItems).
 * Fallback: config.gallery static list when the gallery table is empty/unreachable.
 */

import { useEffect, useState, useMemo } from "react";
import { Link } from "wouter";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { applySeo, breadcrumb } from "@/lib/seo";
import { ArrowRight } from "lucide-react";
import config from "@/lib/tenant";
import { useGalleryItems } from "@/lib/content";

const { gallery, brand } = config;

type Cat = "all" | string;

export default function Gallery() {
  const { items: dbItems, ready } = useGalleryItems();
  const [filter, setFilter] = useState<Cat>("all");

  useEffect(() => {
    applySeo({
      title: `Gallery · ${brand.name}`,
      description: `Browse photos of the room and past nights at ${brand.name}.`,
      path: "/gallery",
      jsonLd: [breadcrumb([{ name: "Home", path: "/" }, { name: "Gallery", path: "/gallery" }])],
    });
  }, []);

  const combinedItems = useMemo(() => {
    if (dbItems.length > 0) {
      return dbItems.map((item) => ({
        src: item.imageUrl,
        alt: item.caption ?? "Gallery photo",
        category: item.category ?? undefined,
      }));
    }
    return gallery.map((g) => ({
      src: g.src,
      alt: g.alt,
      category: g.category,
    }));
  }, [dbItems, ready]);

  const allCategories = Array.from(
    new Set(combinedItems.map((i) => i.category).filter(Boolean))
  ) as string[];

  const FILTERS: { key: Cat; label: string }[] = [
    { key: "all", label: "All" },
    ...allCategories.map((cat) => ({ key: cat, label: cat.charAt(0).toUpperCase() + cat.slice(1) })),
  ];

  const visible = useMemo(
    () => (filter === "all" ? combinedItems : combinedItems.filter((i) => i.category === filter)),
    [filter, combinedItems]
  );

  return (
    <SiteShell>
      <section className="bg-gradient-to-br from-muted to-background pt-12 sm:pt-20 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p className="text-xs uppercase tracking-[0.28em] text-primary font-bold">Gallery</p>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight mt-3 leading-[1.05] max-w-3xl">
            Singing, dancing, <span className="font-serif italic font-medium text-primary">good times</span>.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            A look at the room and past nights at {brand.name}.
          </p>
        </div>
      </section>

      {FILTERS.length > 1 && (
        <section className="sticky top-[64px] sm:top-[72px] lg:top-[120px] z-20 bg-background/95 backdrop-blur border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex gap-2 overflow-x-auto no-scrollbar">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold tracking-wide transition-colors ${
                  filter === f.key
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-card border border-card-border hover-elevate text-foreground/80"
                }`}
                data-testid={`filter-${f.key}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="py-8 sm:py-12 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {visible.map((item, i) => (
              <figure
                key={item.src + i}
                className={`group relative overflow-hidden rounded-2xl bg-muted ${i % 7 === 0 ? "sm:col-span-2 sm:row-span-2 aspect-square" : "aspect-[3/4]"}`}
              >
                <img
                  src={item.src}
                  alt={item.alt}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <figcaption className="absolute bottom-3 left-3 right-3 text-white text-xs sm:text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.category && (
                    <span className="inline-block px-2 py-0.5 rounded-full bg-primary/90 text-[10px] uppercase tracking-wider font-bold">
                      {item.category}
                    </span>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
          {visible.length === 0 && (
            <p className="text-center text-muted-foreground py-16">No gallery photos in this category yet — check back soon.</p>
          )}
        </div>
      </section>

      <section className="py-16 sm:py-20 bg-foreground text-white text-center">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight">
            Ready for a night like this?
          </h2>
          <p className="text-white/80 mt-3 text-base">
            Book the room online and we'll find a date that suits your crowd.
          </p>
          <Link href="/book">
            <Button size="lg" className="rounded-full px-8 py-6 mt-7 text-base font-semibold shadow-xl">
              Book the room <ArrowRight className="size-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </section>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </SiteShell>
  );
}
