# Glastic Designs Website

Modern website for **Glastic Designs Interior Styles** — upcycling plastic waste into beautiful, durable interior products in Trinidad and Tobago.

## About
Founded by Alicia Barrie-George. We transform discarded plastic into tiles, furniture (benches, shelves, stools), coasters, clocks, awards and refurbished school furniture. Building a circular economy locally.

## Features
- Responsive modern design
- Product showcase
- Process & impact sections
- Direct WhatsApp and social links
- Shopping cart with quantities, saved in the browser, and one demo TTD checkout (card details are not saved or sent; WiPay can be connected later)
- Real photos from the Glastic Designs Facebook page (hero, about, gallery, and every product page)
- Based on content from the official Facebook page

## Deploy
This is a static site. Deploy `index.html`, `payments.js`, and assets to Vercel, Netlify, or any static host.

### Vercel
1. Push this folder to a GitHub repository.
2. Import the repo in Vercel.
3. Set the root directory if needed, or deploy as static.

## Owner shop (simple phone dashboard)

After sign-in at **`/admin`**, the owner sees **“What would you like to do?”** with six large buttons: add a product, change a price, change photos, hide/show sold-out items, edit homepage words, and pick one of four colour looks. Each task is one short screen; saving goes live immediately with a **Done – it's on your website** screen.

- **Add to Home Screen:** `/admin/manifest.webmanifest`
- **Stay signed in:** HttpOnly cookie, 30 days (`SESSION_DAYS`)
- **Developer / advanced:** **More settings** → `/admin/advanced.html` (visual editor, full forms, gallery, contact, product list)

Products and site copy use Neon Postgres and Vercel Blob via `/api/admin/*`. Local dev: `node scripts/dev-server.js`. Mobile UI smoke test: `node scripts/test-simple-admin-mobile.mjs`.

## Contact
WhatsApp: 775-2407  
Facebook: https://www.facebook.com/gdistyles  
Instagram: @glasticdesigns

Made with ♻️ in Trinidad & Tobago.