/**
 * client/src/lib/pages.ts
 * ─────────────────────────
 * usePages() — the site nav, backed by /api/public/pages (admin-editable
 * order/visibility via Admin > Pages). Falls back to the current default
 * page set while loading or if the request fails, so the nav never flashes
 * empty.
 */

import { useQuery } from "@tanstack/react-query";

export interface SitePage {
  id: number;
  slug: string;
  navLabel: string;
  path: string;
  kind: "core" | "custom";
  layout: string | null;
  sortOrder: number;
  visible: boolean;
}

const FALLBACK_PAGES: SitePage[] = [
  { id: -1, slug: "home", navLabel: "Home", path: "/", kind: "core", layout: null, sortOrder: 0, visible: true },
  { id: -2, slug: "how-it-works", navLabel: "How It Works", path: "/how-it-works", kind: "core", layout: null, sortOrder: 1, visible: true },
  { id: -3, slug: "services", navLabel: "Services", path: "/services", kind: "core", layout: null, sortOrder: 2, visible: true },
  { id: -4, slug: "gallery", navLabel: "Gallery", path: "/gallery", kind: "core", layout: null, sortOrder: 3, visible: true },
  { id: -5, slug: "about", navLabel: "About", path: "/about", kind: "core", layout: null, sortOrder: 4, visible: true },
  { id: -6, slug: "contact", navLabel: "Contact", path: "/contact", kind: "core", layout: null, sortOrder: 5, visible: true },
];

async function fetchPages(): Promise<SitePage[]> {
  const res = await fetch("/api/public/pages");
  if (!res.ok) throw new Error("pages fetch failed");
  return res.json();
}

export function usePages(): SitePage[] {
  const { data } = useQuery<SitePage[]>({
    queryKey: ["/api/public/pages"],
    queryFn: fetchPages,
    staleTime: 60_000,
    retry: 1,
  });
  return data ?? FALLBACK_PAGES;
}
