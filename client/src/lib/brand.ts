/**
 * client/src/lib/brand.ts
 * ────────────────────────
 * useBrand() — DB-backed brand/business/policy/service-area config, with
 * tenant.config.ts values as fallbacks. Backed by /api/public/brand-config.
 *
 * isInServiceArea() — normalises a postcode and checks its outcode against
 * the admin-managed allowed list.
 */

import { useQuery } from "@tanstack/react-query";
import config from "@/lib/tenant";

export interface BrandConfig {
  ownerName: string;
  brandName: string;
  brandShortName: string;
  tagline: string;
  instagram: string;
  email: string;
  phone: string;
  colors: {
    primary: string;
    accent: string;
    background: string;
    foreground: string;
  };
  fonts: {
    display: string;
    body: string;
  };
  policy: {
    cancellationNoticeHours: number;
    refundPercentInsideNotice: number;
    body: string;
  };
  serviceAreas: string[];
}

const defaults: BrandConfig = {
  ownerName: config.business.ownerName,
  brandName: config.brand.name,
  brandShortName: config.brand.shortName,
  tagline: config.brand.tagline,
  instagram: config.brand.instagram ?? "",
  email: config.business.email,
  phone: config.business.phoneDisplay || config.business.phone,
  colors: {
    primary: config.brand.colors.primary,
    accent: config.brand.colors.accent,
    background: config.brand.colors.background,
    foreground: config.brand.colors.foreground,
  },
  fonts: {
    display: config.brand.fonts.display,
    body: config.brand.fonts.body,
  },
  policy: {
    cancellationNoticeHours: 24,
    refundPercentInsideNotice: 0,
    body:
      "Cancellations made more than [N] hours before your appointment receive a full booking fee refund. Cancellations within [N] hours are non-refundable.",
  },
  serviceAreas: ["NE22", "NE23", "NE24", "NE25", "NE26", "NE27", "NE28", "NE61", "NE62", "NE63", "NE64", "NE65"],
};

export function useBrand(): BrandConfig {
  const { data } = useQuery<BrandConfig>({
    queryKey: ["/api/public/brand-config"],
    queryFn: async () => {
      const res = await fetch("/api/public/brand-config");
      if (!res.ok) throw new Error("brand-config fetch failed");
      return (await res.json()) as BrandConfig;
    },
    staleTime: 60_000,
    retry: 1,
  });
  return data ?? defaults;
}

/**
 * Normalise a UK postcode and extract its outcode, then check membership
 * in the allowed outcode list. Soft check — caller decides what to do.
 */
export function isInServiceArea(
  postcode: string,
  outcodes: string[]
): { ok: boolean; outcode: string } {
  const normalised = postcode.toUpperCase().replace(/\s+/g, "");
  // Outcode = leading area+district before the inward code (last 3 chars: NLL).
  // Match the standard UK outward prefix: 1-2 letters, 1-2 digits, optional letter.
  const m = normalised.match(/^[A-Z]{1,2}\d{1,2}[A-Z]?/);
  const outcode = m ? m[0] : normalised;
  const allowed = outcodes.map((o) => o.toUpperCase());
  return { ok: allowed.includes(outcode), outcode };
}
