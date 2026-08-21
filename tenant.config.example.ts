/**
 * tenant.config.example.ts
 * ─────────────────────────
 * Reference / working example using the original House of Meraki Studio values.
 * Copy this to tenant.config.ts and edit it to rebrand the site.
 *
 * DO NOT import this file directly in application code — import tenant.config.ts.
 */

import type { TenantConfig } from "./shared/tenant-types";

const config: TenantConfig = {
  brand: {
    name: "House of Meraki Studio",
    shortName: "Meraki",
    tagline: "Your Journey of Self Expression",
    domain: "houseofmerakistudio.co.uk",
    instagram: "houseofmerakistudio",
    logoPath: "/img/logo.png",
    favicon: "/favicon.png",
    colors: {
      // HSL "H S% L%" — no hsl() wrapper. These are written to CSS custom properties.
      primary: "320 92% 50%",      // signature magenta
      primaryFg: "0 0% 100%",
      accent: "280 50% 78%",       // light purple lavender
      accentFg: "285 45% 18%",
      tertiary: "165 45% 55%",     // sage green — sparing third accent
      tertiaryFg: "0 0% 100%",
      background: "35 40% 97%",   // warm cream
      foreground: "285 45% 18%",  // deep aubergine
      muted: "30 25% 93%",
      mutedFg: "330 12% 38%",
      border: "30 18% 88%",
    },
    fonts: {
      display: "Cabinet Grotesk",
      body: "Satoshi",
    },
  },

  business: {
    ownerName: "Antonia Malone",
    phone: "+447591134200",
    phoneDisplay: "+44 7591 134200",
    email: "antoniamalone@hotmail.com",
    address: {
      line1: "151 Whitegate Drive",
      city: "Blackpool",
      postcode: "FY3 9BX",
      country: "United Kingdom",
    },
    mapsUrl: "https://maps.google.com/?q=151+Whitegate+Drive,+Blackpool+FY3+9BX",
  },

  // 0=Sun, 1=Mon … 6=Sat
  hours: {
    0: { enabled: true,  note: "By request" },
    1: { enabled: false },
    2: { enabled: true,  start: "10:00", end: "18:00" },
    3: { enabled: true,  start: "10:00", end: "18:00" },
    4: { enabled: true,  start: "10:00", end: "18:00" },
    5: { enabled: true,  start: "10:00", end: "18:00" },
    6: { enabled: true,  start: "07:00", end: "19:00" },
  },

  room: {
    sessionDurationMinutes: 60,
    depositAmount: 50,
    depositRefundDescription: "against your total on the day",
    maxPartySize: 6,
  },

  copy: {
    heroTitle: "Your Journey of Self Expression",
    heroSubtitle:
      "At House of Meraki Studio, we believe in the power of transformation through makeup and wigs. It's a journey of self-expression, each brush stroke at a time. Our inclusive environment welcomes everyone to embrace their individualism.",
    aboutTitle: "Hi, I'm Antonia.",
    aboutBody:
      "I'm the artist, owner and only pair of hands behind House of Meraki Studio. I built this place because I believe everyone — bride, glam regular, wig client, woman in transition — deserves a calm, beautiful space where the only goal is your version of beautiful.\n\n\"Meraki\" is a Greek word for doing something with soul, creativity and love. That's the standard I hold every appointment to.\n\nI started doing makeup for friends in my bedroom. One bride became three; three became a calendar full of weddings, photoshoots, prom seasons and the kind of clients who tell their friends.\n\nAlong the way I trained with some of the artists I admired most, added wig work to my offering and — most importantly — opened my doors to clients other studios still aren't ready for. Male-to-female transformations are now a specialism I'm deeply proud of: a service that demands technical skill, total privacy and unconditional respect.\n\nHouse of Meraki is where all of it lives now: a calm studio on Whitegate Drive, one chair, full attention. I'd love to welcome you in.",
    bookingHeroSubtitle:
      "Real-time availability · 50% deposit secures your slot · Personal reply within 24 hours.",
    homeBullets: [
      "Real-time availability — pick from open slots only",
      "50% deposit secures your slot · balance on the day",
      "Personal reply from Antonia within 24 hours",
      "Cancel free up to 48 hours before",
    ],
    howItWorksTitle: "How a Booking With Us Works",
    howItWorksIntro:
      "From booking to your finished look — here's exactly what to expect when you visit House of Meraki Studio.",
    howItWorksSteps: [
      "Book your slot online and pay a 50% deposit to secure it.",
      "I'll confirm the appointment personally within 24 hours.",
      "On the day, come to the studio on Whitegate Drive — one chair, full attention, no rush.",
      "We'll talk through the look you want before I start, so there are no surprises.",
      "Balance is due on the day, by card or bank transfer.",
      "Cancel or reschedule free up to 48 hours before your appointment.",
    ],
  },

  gallery: [
    { src: "/img/photos/bridal-natural-portrait.jpg", alt: "Natural bridal portrait — soft glow and effortless updo", category: "bridal" },
    { src: "/img/photos/bridal-party-celebration.jpg", alt: "Bride and bridesmaids celebrating after makeup", category: "bridal" },
    { src: "/img/photos/hero-pink-lash.jpg", alt: "Editorial pink eye and lash close-up", category: "glam" },
    { src: "/img/photos/highlight-glam-pinup.jpg", alt: "Vintage pin-up glam with red lip and pin curls", category: "glam" },
    { src: "/img/photos/glam-blonde-lashes.jpg", alt: "Glam blonde with full lash and nude lip", category: "glam" },
    { src: "/img/photos/glam-silver-smokey.jpg", alt: "Silver smokey eye glam with topknot styling", category: "glam" },
    { src: "/img/photos/glam-warm-smokey.jpg", alt: "Warm smokey eye with curls", category: "glam" },
    { src: "/img/photos/glam-classic-portrait.jpg", alt: "Classic studio glam with curled hair", category: "glam" },
    { src: "/img/photos/highlight-inclusive-smile.jpg", alt: "Warm auburn transformation portrait", category: "transformation" },
    { src: "/img/photos/highlight-wig-red-bob.jpg", alt: "Red bob wig install with confident smile", category: "transformation" },
    { src: "/img/photos/mtf-soft-glam-blonde.jpg", alt: "Soft glam transformation with blonde wig", category: "transformation" },
    { src: "/img/photos/highlight-creative-hair.jpg", alt: "Creative pink and orange hair styling with bold eye", category: "creative" },
  ],

  payments: {
    mode: "mvp",
    contactWindow: "24 hours",
    currency: "GBP",
    currencySymbol: "£",
  },

  admin: {
    passcode: "fabulous",
  },

  seo: {
    siteUrl: "https://houseofmerakistudio.co.uk",
    defaultTitle: "House of Meraki Studio · Makeup Artist in Blackpool · Bridal, Glam & MTF Transformations",
    defaultDescription:
      "Inclusive Blackpool makeup studio. Bridal makeup, special occasion glam, wig installation, 1-to-1 lessons and male-to-female transformations. Book online with a 50% deposit.",
    ogImage: "/img/og-default.png",
  },
};

export default config;
