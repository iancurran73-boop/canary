/**
 * shared/tenant-types.ts
 * ──────────────────────
 * Canonical TypeScript interface for a GeneralBooking tenant configuration.
 * Import TenantConfig wherever you need type-safety against tenant.config.ts.
 *
 * Changes here must be reflected in tenant.config.example.ts and tenant.config.ts.
 */

export interface TenantConfig {
  brand: {
    /** Full studio/business name — used in page titles and headings */
    name: string;
    /** Short name for compact contexts (header, footer tagline) */
    shortName: string;
    /** Hero subheadline / studio tagline */
    tagline: string;
    /** Bare domain (no protocol), e.g. "sophiespamperedpaws.co.uk" */
    domain: string;
    /** Instagram handle WITHOUT the @ sign */
    instagram?: string;
    /** Root-relative path to logo image, e.g. "/img/logo.png" */
    logoPath: string;
    /** Root-relative favicon path, e.g. "/favicon.png" */
    favicon: string;
    colors: {
      /**
       * All colours use "H S% L%" format (NO hsl() wrapper).
       * These values are injected as CSS custom properties at runtime.
       */
      /** Deep primary brand colour — e.g. "285 45% 18%" */
      primary: string;
      /** Foreground text on primary colour */
      primaryFg: string;
      /** Accent / highlight colour — e.g. "280 50% 78%" */
      accent: string;
      /** Foreground text on accent colour */
      accentFg: string;
      /** Page background */
      background: string;
      /** Default foreground text colour */
      foreground: string;
      /** Muted surface colour */
      muted: string;
      /** Muted foreground text */
      mutedFg: string;
      /** Default border colour */
      border: string;
    };
    fonts: {
      /** Google Fonts family name for display/heading text, e.g. "Cormorant Garamond" */
      display: string;
      /** Google Fonts family name for body text, e.g. "Inter" */
      body: string;
    };
  };

  business: {
    /** Name of the owner / lead groomer — used in copy throughout the site */
    ownerName: string;
    /** Phone in E.164 format — used in tel: links, e.g. "+447591134200" */
    phone: string;
    /** Human-readable phone for display, e.g. "+44 7591 134200" */
    phoneDisplay: string;
    /** Contact email address */
    email: string;
    address: {
      line1: string;
      city: string;
      postcode: string;
      country: string;
    };
    /** Optional Google Maps URL for the "Get directions" link */
    mapsUrl?: string;
  };

  /**
   * Opening hours keyed by day-of-week: 0=Sunday … 6=Saturday.
   * Set enabled:false for closed days. Use note for "By request" etc.
   */
  hours: {
    [day: number]: {
      enabled: boolean;
      start?: string;   // "HH:MM"
      end?: string;     // "HH:MM"
      note?: string;    // e.g. "By request"
    };
  };

  services: Array<{
    /** Stable integer ID — must match what is seeded into Supabase */
    id: number;
    name: string;
    description: string;
    durationMinutes: number;
    /** Full price in integer pounds (GBP) */
    price: number;
    /** Percentage of price taken as deposit, e.g. 50 */
    depositPercent: number;
    /** Root-relative image path, e.g. "/img/service-full-groom.png" */
    imageUrl: string;
    /** Category label for grouping on the services page */
    category: string;
    /** If true, displayed as "from £X" */
    fromPrice?: boolean;
    sortOrder: number;
    active: boolean;
  }>;

  copy: {
    heroTitle: string;
    heroSubtitle: string;
    aboutTitle: string;
    /** Multi-paragraph body — render with whitespace-pre-line or split on "\n\n" */
    aboutBody: string;
    /** Subtitle shown on the /book page header */
    bookingHeroSubtitle: string;
    /** Bullet points shown in the booking CTA section on the homepage */
    homeBullets: string[];
    howItWorksTitle: string;
    howItWorksIntro: string;
    /** Numbered steps shown on the /how-it-works page */
    howItWorksSteps: string[];
  };

  gallery: Array<{
    src: string;
    alt: string;
    category?: string;
  }>;

  payments: {
    /**
     * "mvp" — contact-owner flow (default). SumUp hosted checkout is enabled
     * separately via the admin Payments tab (server-controlled).
     */
    mode: "mvp";
    /** Used in the MVP contact screen — e.g. "24 hours" */
    contactWindow: string;
    /** ISO 4217 currency code, e.g. "GBP" */
    currency: string;
    /** Symbol for display, e.g. "£" */
    currencySymbol: string;
  };

  admin: {
    /**
     * Passcode for the admin portal — compared case-insensitively.
     * Keep this secret; do not commit the real tenant.config.ts to a public repo.
     */
    passcode: string;
  };

  seo: {
    /** Full canonical site URL with protocol, e.g. "https://sophiespamperedpaws.co.uk" */
    siteUrl: string;
    /** Default <title> for pages that don't override it */
    defaultTitle: string;
    /** Default meta description */
    defaultDescription: string;
    /** Root-relative path to the default OG image */
    ogImage: string;
  };
}
