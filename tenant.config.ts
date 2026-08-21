/**
 * tenant.config.ts
 * ─────────────────────────
 * Sophie's Pampered Paws — In-Home Dog Grooming, Cramlington & Northumberland.
 * Populated from the original SPP_Booking_App_v4 source.
 * Annabelle can edit all visible copy via the admin Content tab.
 */

import type { TenantConfig } from "./shared/tenant-types";

const config: TenantConfig = {
  brand: {
    name: "Sophie's Pampered Paws",
    shortName: "Pampered Paws",
    tagline: "Your dog deserves pampered perfection",
    domain: "sophiespamperedpaws.co.uk",
    instagram: "sophiespamperedpaws", // TBC — Annabelle to confirm
    logoPath: "",
    favicon: "/favicon.png",
    colors: {
      // HSL "H S% L%" — taken from original SPP CSS variables:
      //   --pink #e8387a   --gold #e8a820   --green #2db87a   --cream #fef9f5
      primary: "338 79% 56%",        // signature pink   ~ #e8387a
      primaryFg: "0 0% 100%",
      accent: "40 81% 52%",          // warm gold accent ~ #e8a820
      accentFg: "240 30% 14%",
      background: "30 60% 98%",      // warm cream       ~ #fef9f5
      foreground: "240 30% 14%",     // near-black ink   ~ #1a1a2e
      muted: "338 70% 96%",          // pink-light wash  ~ #fff0f5
      mutedFg: "0 0% 40%",
      border: "335 50% 88%",         // soft pink border ~ #f0d0e0
    },
    fonts: {
      // Nunito carries the original SPP feel; Fraunces is a warm soft serif
      // counterpoint for display headings. Annabelle can swap later.
      display: "Fraunces",
      body: "Nunito",
    },
  },

  business: {
    ownerName: "Annabelle",
    phone: "+440000000000",            // TBC
    phoneDisplay: "TBC",
    email: "hello@sophiespamperedpaws.co.uk", // TBC
    address: {
      line1: "In-home service",
      city: "Cramlington",
      postcode: "NE23",
      country: "United Kingdom",
    },
    mapsUrl: "https://maps.google.com/?q=Cramlington,+Northumberland",
  },

  // 0=Sun, 1=Mon … 6=Sat — from original SPP availability seed
  hours: {
    0: { enabled: false },
    1: { enabled: true,  start: "09:00", end: "17:00" },
    2: { enabled: true,  start: "09:00", end: "17:00" },
    3: { enabled: true,  start: "09:00", end: "17:00" },
    4: { enabled: true,  start: "09:00", end: "17:00" },
    5: { enabled: true,  start: "09:00", end: "17:00" },
    6: { enabled: true,  start: "09:00", end: "17:00" },
  },

  services: [
    {
      id: 1,
      name: "Full Groom",
      description: "Bath, dry, cut, brush, nails and finish. Puppy £35 · Small £30–£40 · Medium £40–£50 · Large £50–£60. Final price depends on dog's condition and coat type.",
      durationMinutes: 120,
      price: 30,
      depositPercent: 25,
      imageUrl: "",
      category: "Full Groom",
      fromPrice: true,
      sortOrder: 1,
      active: true,
    },
    {
      id: 2,
      name: "Bath & Tidy Up",
      description: "Bath, blow dry, brush and a light tidy. Small £30–£40 · Medium £40–£50 · Large £50–£60. Final price depends on dog's condition and coat type.",
      durationMinutes: 120,
      price: 30,
      depositPercent: 25,
      imageUrl: "",
      category: "Bath",
      fromPrice: true,
      sortOrder: 2,
      active: true,
    },
    {
      id: 3,
      name: "Bath & Deshed",
      description: "Deep bath, deshedding treatment and dry. Small £30–£40 · Medium £40–£50 · Large £50–£60. Best for double-coated breeds and heavy shedders.",
      durationMinutes: 120,
      price: 30,
      depositPercent: 25,
      imageUrl: "",
      category: "Bath",
      fromPrice: true,
      sortOrder: 3,
      active: true,
    },
    {
      id: 4,
      name: "Nail Clipping",
      description: "Add-on or stand-alone. Quick, calm trim with treats. £10 — all sizes.",
      durationMinutes: 15,
      price: 10,
      depositPercent: 0,
      imageUrl: "",
      category: "Add-on",
      sortOrder: 4,
      active: true,
    },
    {
      id: 5,
      name: "Feet Trim",
      description: "Trim around the paws — keeps feet neat and prevents matting between the pads. £10 — all sizes.",
      durationMinutes: 15,
      price: 10,
      depositPercent: 0,
      imageUrl: "",
      category: "Add-on",
      sortOrder: 5,
      active: true,
    },
  ],

  copy: {
    heroTitle: "Your Dog Deserves Pampered Perfection",
    heroSubtitle:
      "Professional in-home dog grooming across Cramlington and Northumberland — gentle, stress-free grooming at your own home.",
    aboutTitle: "Hello, I'm Annabelle",
    aboutBody:
      "I run Sophie's Pampered Paws — an in-home dog grooming service covering Cramlington and the wider Northumberland area.\n\nI come to you and set up a fully-fitted grooming station in your home, so your dog never has to leave home. That means no cages, no waiting around with other dogs, and a much calmer experience — especially good for nervous pups, puppies and older dogs.\n\nEvery groom is one-to-one. (Annabelle: you can edit this in the admin Content tab to add your own story.)",
    bookingHeroSubtitle:
      "Pick a service, a date and a time that suits you. I'll confirm by message within 24 hours.",
    homeBullets: [
      "In-home — I come to you",
      "Calm, one-to-one grooming",
      "All sizes and coat types",
      "Cramlington & Northumberland",
    ],
    howItWorksTitle: "How My In-Home Dog Grooming Service Works",
    howItWorksIntro:
      "From arrival to a clean, happy dog — here's exactly what to expect when I come to groom your dog at home.",
    howItWorksSteps: [
      "I come into your home, so your dog can stay relaxed in their own familiar surroundings.",
      "I set up my foldable grooming table in a suitable area of your home.",
      "For bathing, I use a small portable white bath that fits securely inside your bath or shower. If you prefer, I'm also happy to use your bath or shower directly.",
      "I bring everything needed for the groom, including the dryer, clippers, scissors, brushes, shampoos, and all other grooming equipment.",
      "All I need from you is access to water and electricity.",
      "Once your dog's groom is complete, I pack everything away and leave the area clean and tidy.",
    ],
  },

  gallery: [
    // Empty — Annabelle will upload photos via the admin Content tab.
  ],

  payments: {
    // Owner has chosen SumUp. Mode stays "mvp" until the SumUp Payment Link
    // flow is wired in; the contact-within-24-hours screen still shows.
    mode: "mvp",
    contactWindow: "24 hours",
    currency: "GBP",
    currencySymbol: "£",
  },

  admin: {
    // Passcode-only login (case-insensitive). Annabelle can change this here later.
    passcode: "W3lcome",
  },

  seo: {
    siteUrl: "https://sophiespamperedpaws.co.uk",
    defaultTitle: "Sophie's Pampered Paws · In-Home Dog Grooming · Cramlington & Northumberland",
    defaultDescription:
      "Friendly, professional in-home dog grooming across Cramlington and Northumberland. Full grooms, bath and tidy, deshedding, nails and feet trims — done calmly in your own home. Book online.",
    ogImage: "/img/og-default.png",
  },
};

export default config;
