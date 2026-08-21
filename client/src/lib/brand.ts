/**
 * client/src/lib/brand.ts
 * ────────────────────────
 * useBrand() — DB-backed brand/business/policy config, with tenant.config.ts
 * values as fallbacks. Backed by /api/public/brand-config.
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
    primaryFg: string;
    accent: string;
    accentFg: string;
    tertiary: string;
    tertiaryFg: string;
    background: string;
    foreground: string;
    muted: string;
    mutedFg: string;
    border: string;
  };
  fonts: {
    display: string;
    body: string;
  };
  italicAccent: boolean;
  policy: {
    cancellationNoticeHours: number;
    refundPercentInsideNotice: number;
    body: string;
  };
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
    primaryFg: config.brand.colors.primaryFg,
    accent: config.brand.colors.accent,
    accentFg: config.brand.colors.accentFg,
    tertiary: config.brand.colors.tertiary,
    tertiaryFg: config.brand.colors.tertiaryFg,
    background: config.brand.colors.background,
    foreground: config.brand.colors.foreground,
    muted: config.brand.colors.muted,
    mutedFg: config.brand.colors.mutedFg,
    border: config.brand.colors.border,
  },
  fonts: {
    display: config.brand.fonts.display,
    body: config.brand.fonts.body,
  },
  italicAccent: config.brand.italicAccent ?? true,
  policy: {
    cancellationNoticeHours: 48,
    refundPercentInsideNotice: 0,
    body:
      "Cancellations made more than [N] hours before your booking receive a full deposit refund. Cancellations within [N] hours are non-refundable.",
  },
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
