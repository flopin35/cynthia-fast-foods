// Orders API for Cynthia Fast Foods
// POST   /api/orders            public: the website saves a new order (status "new")
// GET    /api/orders            admin:  list all orders
// PUT    /api/orders            admin:  add or replace orders  { orders: [ {id, ...} ] }
// PATCH  /api/orders            admin:  change status          { id, status }
// DELETE /api/orders?id=CFF-XX  admin:  delete one order
//
// Admin calls need the header  Authorization: Bearer <ADMIN_PASSWORD>
// ADMIN_PASSWORD is set in Vercel → Project → Settings → Environment Variables.

import { put, list, get, del } from "@vercel/blob";
import { timingSafeEqual } from "node:crypto";

const PREFIX = "orders/";
const ACCESS = "private";
const STATUSES = ["new", "confirmed", "cancelled"];

const str = (v, max) => String(v ?? "").trim().slice(0, max);
const num = (v, min, max) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min; };
const safeId = (v) => str(v, 60).replace(/[^A-Za-z0-9_\-.]/g, "-");

function cleanOrder(o, { fromAdmin = false } = {}) {
  if (!o || typeof o !== "object") return null;
  const items = (Array.isArray(o.items) ? o.items : []).slice(0, 40).map((i) => ({
    id: str(i && i.id, 40),
    name: str(i && i.name, 80),
    cat: str(i && i.cat, 20),
    price: num(i && i.price, 0, 5000),
    q: Math.round(num(i && i.q, 0, 99)),
  })).filter((i) => i.name && i.q > 0);
  if (!items.length) return null;
  const discounts = (Array.isArray(o.discounts) ? o.discounts : []).slice(0, 5).map((d) => ({
    label: str(d && d.label, 80), amount: num(d && d.amount, 0, 20000),
  }));
  const subtotal = items.reduce((s, i) => s + i.price * i.q, 0);
  const discount = num(o.discount ?? discounts.reduce((s, d) => s + d.amount, 0), 0, subtotal);
  const fee = num(o.fee, 0, 500);
  const status = fromAdmin ? (STATUSES.includes(o.status) ? o.status : "confirmed") : "new";
  return {
    ref: str(o.ref, 30) || "Website",
    items, discounts, subtotal, discount, fee,
    total: fromAdmin ? num(o.total, 0, 100000) : Math.max(0, subtotal - discount + fee),
    mode: ["delivery", "pickup", "walk-in"].includes(o.mode) ? o.mode : "delivery",
    pay: o.pay === "Cash" ? "Cash" : "Mobile Money",
    customer: str(o.customer, 60), phone: str(o.phone, 30), address: str(o.address, 160), notes: str(o.notes, 300),
    promo: str(o.promo, 30),
    source: fromAdmin ? (str(o.source, 20) || "admin") : "website",
    status,
    ts: fromAdmin ? num(o.ts, 0, 8.64e15) || Date.now() : Date.now(),
    savedAt: Date.now(),
  };
}

function isAdmin(req) {
  const pass = process.env.ADMIN_PASSWORD || "";
  const got = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!pass || !got) return false;
  const a = Buffer.from(pass), b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readAll() {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const out = [];
  for (let i = 0; i < blobs.length; i += 25) {
    const chunk = await Promise.all(blobs.slice(i, i + 25).map(async (b) => {
      try {
        const r = await get(b.pathname, { access: ACCESS, useCache: false });
        if (!r || r.statusCode !== 200) return null;
        const data = JSON.parse(await new Response(r.stream).text());
        return { id: b.pathname.slice(PREFIX.length).replace(/\.json$/, ""), ...data };
      } catch { return null; }
    }));
    out.push(...chunk.filter(Boolean));
  }
  return out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

async function readOne(id) {
  try {
    const r = await get(`${PREFIX}${id}.json`, { access: ACCESS, useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return JSON.parse(await new Response(r.stream).text());
  } catch { return null; }
}

const write = (id, data, overwrite) => put(`${PREFIX}${id}.json`, JSON.stringify(data), {
  access: ACCESS, addRandomSuffix: false, allowOverwrite: overwrite, contentType: "application/json",
});

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  try {
    if (req.method === "POST") {
      const id = safeId(body.ref);
      if (!/^CFF-[A-Z0-9]{3,10}$/.test(id)) return res.status(400).json({ error: "bad_ref" });
      const order = cleanOrder(body);
      if (!order) return res.status(400).json({ error: "no_items" });
      order.ref = id;
      try { await write(id, order, false); }
      catch (e) { if (/exist/i.test(String(e && e.message))) return res.status(409).json({ error: "duplicate" }); throw e; }
      return res.status(201).json({ ok: true, id });
    }

    if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ error: "not_configured" });
    if (!isAdmin(req)) return res.status(401).json({ error: "unauthorized" });

    if (req.method === "GET") {
      return res.status(200).json({ orders: await readAll() });
    }
    if (req.method === "PUT") {
      const list = (Array.isArray(body.orders) ? body.orders : []).slice(0, 200);
      let saved = 0;
      for (const o of list) {
        const id = safeId(o && (o.id || o.ref));
        const clean = cleanOrder(o, { fromAdmin: true });
        if (!id || !clean) continue;
        await write(id, clean, true); saved++;
      }
      return res.status(200).json({ ok: true, saved });
    }
    if (req.method === "PATCH") {
      const id = safeId(body.id);
      if (!STATUSES.includes(body.status)) return res.status(400).json({ error: "bad_status" });
      const cur = await readOne(id);
      if (!cur) return res.status(404).json({ error: "not_found" });
      await write(id, { ...cur, status: body.status, savedAt: Date.now() }, true);
      return res.status(200).json({ ok: true });
    }
    if (req.method === "DELETE") {
      const id = safeId(req.query && req.query.id);
      if (!id) return res.status(400).json({ error: "bad_id" });
      await del(`${PREFIX}${id}.json`);
      return res.status(200).json({ ok: true });
    }
    res.setHeader("Allow", "GET, POST, PUT, PATCH, DELETE");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    console.error("orders api error", e);
    return res.status(500).json({ error: "server_error" });
  }
}
