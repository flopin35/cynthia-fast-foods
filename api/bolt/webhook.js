// Bolt Food → Cynthia orders
// Bolt calls this address for order events. Each order is saved to Firestore
// (collection "orders", id "BOLT-<bolt order id>") so it shows in the admin panel
// and the Cynthia Orders app. The original Bolt message is kept in "rawBolt".
//
// Security: Bolt must send the connection token, either as
//   Authorization: Bearer <token>   or   Basic auth (any username, token as password).
// The token is created in the admin panel (Settings → Bolt Food) and stored in
// Firestore at config/bolt, which only the admin can read.

import { timingSafeEqual, createHash } from "node:crypto";
import { configured, getDb } from "../_lib/firebase.js";

let tokenCache = { value: null, at: 0 };

async function getToken(db) {
  if (tokenCache.value && Date.now() - tokenCache.at < 60_000) return tokenCache.value;
  const snap = await db.doc("config/bolt").get();
  tokenCache = { value: snap.exists ? snap.get("token") || null : null, at: Date.now() };
  return tokenCache.value;
}

function presentedToken(req) {
  const h = String(req.headers.authorization || "");
  if (/^Bearer\s+/i.test(h)) return h.replace(/^Bearer\s+/i, "").trim();
  if (/^Basic\s+/i.test(h)) {
    const decoded = Buffer.from(h.replace(/^Basic\s+/i, ""), "base64").toString("utf8");
    return decoded.includes(":") ? decoded.slice(decoded.indexOf(":") + 1) : decoded;
  }
  return String(req.headers["x-cynthia-token"] || "");
}

function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

const pick = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== "");
const num = (v) => {
  if (v && typeof v === "object") v = pick(v.amount, v.value, v.total);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v, max = 120) => String(v ?? "").trim().slice(0, max);
const safeId = (v) => str(v, 60).replace(/[^A-Za-z0-9_\-.]/g, "-");

// Bolt's exact order format is only in their partner docs, so this accepts the
// common field names. Anything it misses is still in rawBolt and can be mapped later.
export function mapBoltEvent(ev) {
  if (!ev || typeof ev !== "object") return null;
  const d = pick(ev.order, ev.data && ev.data.order, ev.data, ev.payload, ev) || {};
  const boltId = pick(d.order_id, d.orderId, d.id, d.order_reference_id, d.reference, d.order_reference, ev.order_id, ev.orderId);
  const type = str(pick(ev.event, ev.event_type, ev.eventType, ev.type, ev.status, d.status, d.state), 60);
  const itemsIn = pick(d.items, d.order_items, d.basket && d.basket.items, d.products, d.lines) || [];
  const items = (Array.isArray(itemsIn) ? itemsIn : []).slice(0, 60).map((it) => {
    const q = Math.max(1, Math.round(num(pick(it.quantity, it.amount, it.count, it.qty, 1))));
    const unit = pick(it.unit_price, it.price, it.item_price);
    const line = pick(it.total_price, it.total, it.line_total);
    const price = unit !== undefined ? num(unit) : line !== undefined ? num(line) / q : 0;
    return { id: str(pick(it.id, it.item_id, it.external_id, it.sku), 40), name: str(pick(it.name, it.title, it.product_name, it.menu_item_name, it.dish_name, "Item"), 80), cat: "", price: Math.round(price * 100) / 100, q };
  });
  const customer = pick(d.customer, d.client, d.eater, d.user) || {};
  const subtotal = items.reduce((s, i) => s + i.price * i.q, 0);
  const total = num(pick(d.total_price, d.total, d.order_total, d.price && d.price.total, d.amount)) || subtotal;
  const ts = Date.parse(pick(d.created, d.created_at, d.createdAt, d.order_created_at, ev.timestamp, ev.created_at) || "") || Date.now();
  const fulfil = str(pick(d.delivery_type, d.order_type, d.fulfillment_type, d.type), 40);
  const id = boltId ? "BOLT-" + safeId(boltId) : "BOLT-" + createHash("sha1").update(JSON.stringify(ev)).digest("hex").slice(0, 12);
  return {
    id,
    cancelled: /cancel|reject|declin|fail/i.test(type),
    order: {
      ref: boltId ? "Bolt " + str(boltId, 30) : "Bolt order",
      items: items.length ? items : [{ id: "", name: "Bolt order (see details in Bolt)", cat: "", price: total, q: 1 }],
      discounts: [], subtotal, discount: 0, fee: num(pick(d.delivery_fee, d.delivery_price)), total, promo: "",
      mode: /pick|takeaway|collect/i.test(fulfil) ? "pickup" : "delivery",
      pay: "Bolt",
      customer: str(pick(customer.name, [customer.first_name, customer.last_name].filter(Boolean).join(" "), d.customer_name, d.client_name), 60),
      phone: str(pick(customer.phone, customer.phone_number, d.customer_phone, d.client_phone), 30),
      address: str(pick(d.delivery_address && (d.delivery_address.address || d.delivery_address.formatted), d.address), 160),
      notes: str(pick(d.comment, d.note, d.notes, d.special_instructions, d.customer_comment), 300),
      source: "bolt", boltId: str(boltId, 60), boltEvent: type, ts,
    },
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  if (!configured()) return res.status(503).json({ ok: false, error: "not_configured", message: "Add FIREBASE_SERVICE_ACCOUNT in Vercel" });
  let db;
  try { db = getDb(); } catch (e) { return res.status(503).json({ ok: false, error: "bad_service_account" }); }

  try {
    // Health check for the admin panel's "Test connection" button. Shares no secrets.
    if (req.method === "GET") {
      const token = await getToken(db);
      return res.status(200).json({ ok: true, service: "cynthia-bolt-webhook", firebase: "ok", tokenSet: !!token });
    }
    if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return res.status(405).json({ ok: false }); }

    const token = await getToken(db);
    if (!token) return res.status(503).json({ ok: false, error: "token_not_set" });
    if (!same(presentedToken(req), token)) return res.status(401).json({ ok: false, error: "unauthorized" });

    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    const events = Array.isArray(body) ? body : [body || {}];
    let saved = 0;
    for (const ev of events.slice(0, 50)) {
      const m = mapBoltEvent(ev);
      if (!m) continue;
      const ref = db.collection("orders").doc(m.id);
      const existing = await ref.get();
      const raw = JSON.stringify(ev).slice(0, 15000);
      if (m.cancelled) {
        if (existing.exists) await ref.set({ status: "cancelled", boltEvent: m.order.boltEvent, rawBolt: raw, savedAt: Date.now() }, { merge: true });
        else await ref.set({ ...m.order, status: "cancelled", rawBolt: raw, savedAt: Date.now() });
      } else {
        const status = existing.exists ? existing.get("status") || "new" : "new";
        await ref.set({ ...m.order, status, rawBolt: raw, savedAt: Date.now() }, { merge: true });
      }
      saved++;
    }
    await db.doc("config/bolt").set({ lastEventAt: Date.now(), lastEventCount: saved }, { merge: true });
    return res.status(200).json({ ok: true, saved });
  } catch (e) {
    console.error("bolt webhook error", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
