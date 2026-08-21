# GeneralBooking — Setup Playbook

A config-driven booking site template. Swap the branding, services and contact details in **one file** and you have a new booking site ready to deploy.

---

## Quick overview

| Layer | File / location |
|---|---|
| Tenant config | `tenant.config.ts` (root) |
| Type definitions | `shared/tenant-types.ts` |
| Reference config (Meraki) | `tenant.config.example.ts` |
| Supabase credentials | `.env` (never commit) |
| Seed script | `scripts/seed-supabase.ts` |

---

## 1. Clone & install

```bash
git clone <your-fork-url> my-booking-site
cd my-booking-site
npm install
```

> Node.js ≥ 18 required.

---

## 2. Edit `tenant.config.ts`

This is the only file you need to edit to rebrand the site. Every field is typed — your editor will autocomplete and flag mistakes.

Open `tenant.config.ts` and update the following sections:

### Required fields

| Field | Example | Notes |
|---|---|---|
| `brand.name` | `"House of Meraki Studio"` | Full business name |
| `brand.shortName` | `"Meraki"` | Used in compact contexts (header, admin) |
| `brand.tagline` | `"Your Journey of Self Expression"` | Hero subheadline |
| `brand.domain` | `"houseofmerakistudio.co.uk"` | Bare domain, no `https://` |
| `brand.logoPath` | `"/img/logo.png"` | Root-relative path in `client/public/` |
| `brand.favicon` | `"/favicon.png"` | Root-relative path |
| `business.ownerName` | `"Antonia Malone"` | Used in copy throughout the site |
| `business.phone` | `"+447591134200"` | E.164 format for `tel:` links |
| `business.phoneDisplay` | `"+44 7591 134200"` | Human-readable display |
| `business.email` | `"antoniamalone@hotmail.com"` | |
| `business.address.*` | `"151 Whitegate Drive"` etc | Street, city, postcode, country |
| `seo.siteUrl` | `"https://houseofmerakistudio.co.uk"` | Full URL with `https://` |
| `admin.passcode` | `"fabulous"` | Case-insensitive admin passcode |

### Colours (`brand.colors`)

Colours use **HSL "H S% L%" format** — no `hsl()` wrapper. Example:

```ts
colors: {
  primary: "320 92% 50%",   // signature magenta
  primaryFg: "0 0% 100%",
  accent: "280 50% 78%",    // light purple lavender
  accentFg: "285 45% 18%",
  background: "35 40% 97%", // warm cream
  foreground: "285 45% 18%",
  muted: "30 25% 93%",
  mutedFg: "330 12% 38%",
  border: "30 18% 88%",
},
```

These values are injected as CSS custom properties at runtime, so changing them instantly re-themes the entire site.

### Fonts (`brand.fonts`)

Specify any **Google Fonts** family name:

```ts
fonts: {
  display: "Cormorant Garamond",  // heading/display font
  body: "Inter",                  // body text
},
```

The font `<link>` tag is injected automatically at startup.

### Hours (`hours`)

Days are keyed `0`–`6` (0 = Sunday). Closed days should have `enabled: false`. Use `note` for "By request" etc:

```ts
hours: {
  0: { enabled: true,  note: "By request" },
  1: { enabled: false },                        // Monday closed
  2: { enabled: true,  start: "10:00", end: "18:00" },
  // …
  6: { enabled: true,  start: "07:00", end: "19:00" },
},
```

### Services (`services`)

Each service needs a stable `id` (integer, must match Supabase). The seed script will upsert them using these IDs as primary keys. Do not change an ID once the database is live.

```ts
services: [
  {
    id: 1,
    name: "Glam — Without Lashes",
    description: "A polished glam look…",
    durationMinutes: 45,
    price: 40,              // integer GBP
    depositPercent: 50,
    imageUrl: "/img/service-glam.png",
    category: "Makeup",
    sortOrder: 1,
    active: true,
  },
  // …
],
```

### Payments (`payments`)

```ts
payments: {
  mode: "mvp",             // "mvp" = contact-owner flow | "stripe" = Stripe checkout
  contactWindow: "24 hours",
  currency: "GBP",
  currencySymbol: "£",
},
```

Set `mode: "stripe"` when you're ready to integrate Stripe (see step 9).

---

## 3. Add brand assets

Drop your images into `client/public/`:

```
client/public/
  favicon.png              ← browser tab icon (32×32 or 64×64 PNG)
  img/
    logo.png               ← your logo (referenced as brand.logoPath)
    og-default.png         ← social sharing image (1200×630 recommended)
    about-studio.png       ← about page image
    service-*.png          ← service card images (referenced in services[].imageUrl)
    photos/
      hero-pink-lash.jpg   ← homepage hero background
      …                    ← gallery photos
```

> Images in `client/public/` are served as-is — no bundling. Keep file sizes reasonable (compress JPEGs to ≤ 200 KB for fast loads).

---

## 4. Create a Supabase project

1. Go to [dashboard.supabase.com](https://dashboard.supabase.com) → **New project**
2. Choose a region close to your users
3. Copy your **Project URL** and **anon / public key** from Settings → API
4. Also copy the **service role key** (needed for the seed script — keep it secret)

---

## 5. Set environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Vite bakes these into the client bundle at build time
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Seed script only — NOT VITE_ prefixed — keep this secret
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Optional — only if using Stripe
# VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

> **Never commit `.env` to version control.** It contains secrets.

---

## 6. Seed the database

```bash
npx tsx scripts/seed-supabase.ts
```

This will:
- Create tables if they don't exist (requires `exec_sql` RPC on Supabase, or run the SQL manually in the Supabase dashboard SQL editor)
- Upsert all services from `tenant.config.ts`
- Upsert opening hours (7 rows)
- Upsert the settings row

**Idempotent:** safe to run multiple times. Re-run after editing `tenant.config.ts` to push changes to the database.

### Manual schema migration (if `exec_sql` RPC not available)

Copy the SQL from `scripts/seed-supabase.ts` (`MIGRATION_SQL` constant) and run it in the **Supabase dashboard → SQL Editor**.

---

## 7. Local development

```bash
npm run dev
```

Visit [http://localhost:5000](http://localhost:5000).

Test the full booking flow:
1. Browse to `/book`
2. Select a service, date, time
3. Fill in your details
4. Confirm booking → should reach the pay/confirm screen

Test admin:
1. Browse to `/#/admin`
2. Enter your `admin.passcode` from `tenant.config.ts`

---

## 8. Deploy to Netlify

### Option A: Drag-and-drop (fastest)

1. Make sure your `.env` is set (Vite needs it at build time):
   ```bash
   npm run build
   ```
2. Drag the `dist/public/` folder onto [app.netlify.com/drop](https://app.netlify.com/drop)

### Option B: Netlify CLI

```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist/public
```

### Setting env vars on Netlify

> **Important:** VITE_ variables are baked into the bundle at build time. You must set them in the Netlify build environment **before building**, not just at runtime.

1. Netlify dashboard → your site → **Site settings → Environment variables**
2. Add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_STRIPE_PUBLISHABLE_KEY` (if using Stripe)
3. Trigger a new build.

### Custom domain

1. Netlify → Domain management → Add custom domain
2. Add a DNS **A record**: `@` → `75.2.60.5`
3. Add a **CNAME**: `www` → `<your-site>.netlify.app`
4. Enable HTTPS (automatic via Let's Encrypt)

---

## 9. Switching to Stripe later

When you're ready to take real card payments:

1. Set `payments.mode: "stripe"` in `tenant.config.ts`
2. Add your Stripe publishable key:
   ```ts
   payments: {
     mode: "stripe",
     stripePublishableKey: "pk_live_...",  // or set VITE_STRIPE_PUBLISHABLE_KEY
     // …
   }
   ```
3. Install Stripe packages:
   ```bash
   npm install @stripe/stripe-js @stripe/react-stripe-js
   ```
4. Open `client/src/pages/pay.tsx` and implement the Stripe Elements section (search for `// TODO: Run: npm install`). You'll need:
   - A server-side endpoint that creates a `PaymentIntent` and returns the `client_secret`
   - `loadStripe(publishableKey)` + `<Elements>` wrapper
   - A `<PaymentElement>` form that calls `stripe.confirmPayment()`
5. Update `config.seo.siteUrl` to your live domain
6. Re-run `npm run build` and re-deploy

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Blank page, console shows "Missing required env vars" | Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` |
| Services not loading | Run `npx tsx scripts/seed-supabase.ts` |
| Admin login fails | Check `admin.passcode` in `tenant.config.ts` (case-insensitive) |
| Logo not showing | Check `brand.logoPath` points to an existing file in `client/public/` |
| Build fails with TypeScript errors | Run `npm run check` to see detailed errors |
| Netlify deploy shows wrong branding | Env vars not set in Netlify build environment — see step 8 |
