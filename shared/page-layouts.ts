/**
 * shared/page-layouts.ts
 * ─────────────────────────
 * The fixed set of layouts an admin can pick from when adding a custom page.
 * Shared between the server (validation) and the client (the layout picker
 * and the generic page renderer's layout switch).
 */

export const PAGE_LAYOUTS = [
  {
    id: "steps",
    label: "Steps",
    description: "Numbered process list + up to 3 photos. Good for \"our process\" or \"what to expect\" pages.",
  },
  {
    id: "story",
    label: "Story",
    description: "Hero image + intro + highlight cards + long-form body. Good for team bios or \"our story\" pages.",
  },
  {
    id: "simple",
    label: "Simple text",
    description: "Title + intro + a block of text + one optional image. A generic catch-all, e.g. for a policy page.",
  },
  {
    id: "gallery",
    label: "Photo gallery",
    description: "Title + intro + a grid of up to 6 photos.",
  },
  {
    id: "faq",
    label: "FAQ",
    description: "Title + intro + a list of questions and answers.",
  },
  {
    id: "testimonials",
    label: "Testimonials",
    description: "Title + intro + your full list of reviews (the same ones shown on the homepage).",
  },
  {
    id: "promo",
    label: "Promo",
    description: "Big hero + a block of text + a single \"Book online\" button. Good for a seasonal offer.",
  },
] as const;

export type PageLayout = (typeof PAGE_LAYOUTS)[number]["id"];

export const PAGE_LAYOUT_IDS = PAGE_LAYOUTS.map((l) => l.id) as PageLayout[];
