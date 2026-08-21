/**
 * client/src/lib/seo.ts
 * ──────────────────────
 * Lightweight document-head manager for the SPA. Updates <title>, meta tags,
 * canonical URL and JSON-LD blocks per route. All tenant-specific values
 * (site URL, default title/description, og:site_name) are read from
 * tenant.config.ts so rebranding requires zero changes here.
 */

import config from "@/lib/tenant";

export type SeoTags = {
  title: string;
  description: string;
  path: string; // e.g. "/services"
  image?: string; // absolute or root-relative
  type?: "website" | "article";
  jsonLd?: Record<string, any>[];
};

const SITE_URL = config.seo.siteUrl;
const DEFAULT_IMAGE = config.seo.ogImage;
const SITE_NAME = config.brand.name;

function setMeta(selector: string, attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export function applySeo(tags: SeoTags) {
  document.title = tags.title;
  setMeta("name", "name", "description", tags.description);
  const url = SITE_URL + tags.path;
  const img = tags.image
    ? (tags.image.startsWith("http") ? tags.image : SITE_URL + tags.image)
    : SITE_URL + DEFAULT_IMAGE;

  setLink("canonical", url);

  setMeta("property", "property", "og:title", tags.title);
  setMeta("property", "property", "og:description", tags.description);
  setMeta("property", "property", "og:url", url);
  setMeta("property", "property", "og:image", img);
  setMeta("property", "property", "og:type", tags.type || "website");
  setMeta("property", "property", "og:site_name", SITE_NAME);
  setMeta("property", "property", "og:locale", "en_GB");

  setMeta("name", "name", "twitter:card", "summary_large_image");
  setMeta("name", "name", "twitter:title", tags.title);
  setMeta("name", "name", "twitter:description", tags.description);
  setMeta("name", "name", "twitter:image", img);

  // Replace JSON-LD blocks in document head
  const existing = document.head.querySelectorAll('script[data-route-jsonld="1"]');
  existing.forEach((s) => s.remove());
  if (tags.jsonLd && tags.jsonLd.length) {
    for (const block of tags.jsonLd) {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.dataset.routeJsonld = "1";
      s.text = JSON.stringify(block);
      document.head.appendChild(s);
    }
  }
}

// ---------- Reusable JSON-LD blocks ----------

export const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": SITE_URL + "/#business",
  name: config.brand.name,
  url: SITE_URL,
  telephone: config.business.phone,
  email: config.business.email,
  logo: SITE_URL + config.brand.favicon,
  address: {
    "@type": "PostalAddress",
    streetAddress: config.business.address.line1,
    addressLocality: config.business.address.city,
    postalCode: config.business.address.postcode,
    addressCountry: "GB",
  },
  sameAs: [
    SITE_URL,
    ...(config.brand.instagram ? [`https://www.instagram.com/${config.brand.instagram}`] : []),
  ],
};

export const breadcrumb = (items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: it.name,
    item: SITE_URL + it.path,
  })),
});
