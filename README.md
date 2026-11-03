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

## Owner shop

The owner manages products at `/admin` on a phone. The first visit asks them to choose a password, which is stored only as a hash. A password can also be supplied with the `ADMIN_PASSWORD` environment variable in Vercel; that value is never shown on the site.

Products and prices live in Neon Postgres. Photos for new uploads live in Vercel Blob. Until Neon is connected, the public site keeps showing the current products.

### Website look (no redeploy)

After signing in at `/admin`, use **Website look & content** to change brand colours, fonts, logo, homepage text and photos, impact stats, gallery, contact links, an announcement banner, and which sections are visible. Changes are stored in the same Neon database (`site_settings` and `gallery_photos` tables, created automatically on first use) and served from `GET /api/settings` with `Cache-Control: no-store`. The public site applies them immediately via `settings.js` (with the current theme cached in the browser to reduce colour flash).

No new environment variables are required beyond existing `DATABASE_URL` / Neon and `BLOB_READ_WRITE_TOKEN`.

## Contact
WhatsApp: 775-2407  
Facebook: https://www.facebook.com/gdistyles  
Instagram: @glasticdesigns

Made with ♻️ in Trinidad & Tobago.