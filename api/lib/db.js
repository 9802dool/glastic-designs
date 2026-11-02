const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');
const { put } = require('@vercel/blob');

const SEED = [
  {
    id: 'tiles',
    name: 'Plastic Tiles',
    description: 'Durable, waterproof wall and floor tiles made from plastic waste. Hexagonal, square, and rectangular shapes are available.',
    category: 'Tiles',
    price: 25,
    file: 'triangle-planter.jpg'
  },
  {
    id: 'benches',
    name: 'Bench or Stool',
    description: 'Compact, sturdy seating for indoors, outdoors, classrooms, and patios.',
    category: 'Furniture',
    price: 250,
    file: 'front-door-garden.jpg'
  },
  {
    id: 'shelves',
    name: 'Shelf or Furniture',
    description: 'Shelving, consoles, and tables with custom heights and colors. Suitable indoors and outdoors.',
    category: 'Furniture',
    price: 300,
    file: 'fern-planter.jpg'
  },
  {
    id: 'coasters',
    name: 'Coasters & Clock',
    description: 'Coasters and clocks made from upcycled plastic. Sample gift set.',
    category: 'Gifts',
    price: 80,
    file: 'planter-frames.jpg'
  },
  {
    id: 'awards',
    name: 'Custom Award',
    description: 'Custom trophies, medals, and keychains for events and gifts.',
    category: 'Gifts',
    price: 200,
    file: 'triangle-planter.jpg'
  },
  {
    id: 'school',
    name: 'School Furniture Refurb',
    description: 'Refurbished school desks and chairs using recycled plastic.',
    category: 'Services',
    price: 150,
    file: 'living-wall.jpg'
  }
];

let sqlClient;
let ready;

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || '';
}

function getSql() {
  const url = databaseUrl();
  if (!url) {
    const error = new Error('database-missing');
    error.code = 'database-missing';
    throw error;
  }
  if (!sqlClient) sqlClient = neon(url);
  return sqlClient;
}

async function ensureSchema() {
  if (!ready) ready = migrate();
  return ready;
}

async function migrate() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS owner_auth (
      id integer PRIMARY KEY,
      password_hash text NOT NULL
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash text PRIMARY KEY,
      expires_at timestamptz NOT NULL
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id text PRIMARY KEY,
      name text NOT NULL,
      description text NOT NULL DEFAULT '',
      category text NOT NULL DEFAULT 'General',
      price_ttd numeric(10,2) NOT NULL,
      sort_order integer NOT NULL,
      hidden boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS product_photos (
      id text PRIMARY KEY,
      product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      url text NOT NULL,
      is_main boolean NOT NULL DEFAULT false,
      sort_order integer NOT NULL DEFAULT 0
    )`;
  const categoryFixes = [
    ['tiles', 'Plastic Tiles', 'Tiles'],
    ['benches', 'Bench or Stool', 'Furniture'],
    ['shelves', 'Shelf or Furniture', 'Furniture'],
    ['coasters', 'Coasters & Clock', 'Gifts'],
    ['awards', 'Custom Award', 'Gifts'],
    ['school', 'School Furniture Refurb', 'Services']
  ];
  for (let i = 0; i < categoryFixes.length; i++) {
    const fix = categoryFixes[i];
    await sql`
      UPDATE products
      SET category = ${fix[2]}
      WHERE id = ${fix[0]} AND name = ${fix[1]} AND category <> ${fix[2]}`;
  }
  const existing = await sql`SELECT count(*)::int AS count FROM products`;
  if (existing[0].count > 0) return;
  for (let i = 0; i < SEED.length; i++) {
    const item = SEED[i];
    await sql`
      INSERT INTO products (id, name, description, category, price_ttd, sort_order, hidden)
      VALUES (${item.id}, ${item.name}, ${item.description}, ${item.category}, ${item.price}, ${i}, false)
      ON CONFLICT (id) DO NOTHING`;
    const url = await storeSeedPhoto(item);
    await sql`
      INSERT INTO product_photos (id, product_id, url, is_main, sort_order)
      VALUES (${item.id + '-main'}, ${item.id}, ${url}, true, 0)
      ON CONFLICT (id) DO NOTHING`;
  }
}

async function storeSeedPhoto(item) {
  const fallback = '/images/' + item.file;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return fallback;
  const filePath = path.join(process.cwd(), 'images', item.file);
  if (!fs.existsSync(filePath)) return fallback;
  try {
    const body = fs.readFileSync(filePath);
    const blob = await put('products/' + item.id + '/main.jpg', body, {
      access: 'public',
      contentType: 'image/jpeg',
      addRandomSuffix: false,
      allowOverwrite: true
    });
    return blob.url;
  } catch (error) {
    return fallback;
  }
}

function mapProduct(row, photos) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    priceTtd: Number(row.price_ttd),
    sortOrder: row.sort_order,
    hidden: row.hidden,
    photos: photos.map(function (photo) {
      return { id: photo.id, url: photo.url, isMain: photo.is_main };
    })
  };
}

async function listProducts(includeHidden) {
  const sql = getSql();
  await ensureSchema();
  const rows = includeHidden
    ? await sql`SELECT id, name, description, category, price_ttd, sort_order, hidden FROM products ORDER BY sort_order, name`
    : await sql`SELECT id, name, description, category, price_ttd, sort_order, hidden FROM products WHERE hidden = false ORDER BY sort_order, name`;
  if (!rows.length) return [];
  const photos = await sql`SELECT id, product_id, url, is_main, sort_order FROM product_photos ORDER BY sort_order, id`;
  return rows.map(function (row) {
    return mapProduct(row, photos.filter(function (photo) { return photo.product_id === row.id; }));
  });
}

module.exports = {
  SEED,
  databaseUrl,
  getSql,
  ensureSchema,
  listProducts
};
