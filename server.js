const express = require("express");
const fs = require("fs");
const fetch = require("node-fetch");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const DATA_PATH = path.join(__dirname, "data");
if (!fs.existsSync(DATA_PATH)) fs.mkdirSync(DATA_PATH);

const ORDERS_FILE = path.join(DATA_PATH, "orders.json");
const TX_FILE = path.join(DATA_PATH, "used_tx.json");

if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, "[]");
if (!fs.existsSync(TX_FILE)) fs.writeFileSync(TX_FILE, "[]");

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "MIAW-SUPER-PAINEL";

// gamepasses por valor
const GAMEPASSES = {
  50: "1591926519",
  70: "1593857095",
  100: "1591582593",
  200: "1594232992"
};

function load(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function robloxUserId(username) {
  const r = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: true })
  });
  const j = await r.json();
  if (!j.data || j.data.length === 0) return null;
  return j.data[0].id;
}

async function userOwnsGamepass(userId, gpId) {
  const r = await fetch(
    `https://inventory.roblox.com/v1/users/${userId}/items/GamePass/${gpId}`
  );
  if (!r.ok) return false;
  const j = await r.json();
  return j.data && j.data.length > 0;
}

app.post("/api/verify", async (req, res) => {
  const { username, tx, total, items } = req.body;

  if (!username || !tx || !total) {
    return res.json({ ok: false, error: "missing_fields" });
  }

  const used = load(TX_FILE);
  if (used.includes(tx)) {
    return res.json({ ok: false, error: "tx_already_used" });
  }

  const gpId = GAMEPASSES[total];
  if (!gpId) {
    return res.json({ ok: false, error: "invalid_total" });
  }

  const userId = await robloxUserId(username);
  if (!userId) {
    return res.json({ ok: false, error: "invalid_username" });
  }

  const owns = await userOwnsGamepass(userId, gpId);
  if (!owns) {
    return res.json({ ok: false, error: "payment_not_found" });
  }

  const orders = load(ORDERS_FILE);
  const newOrder = {
    id: "ORD-" + Date.now(),
    username,
    userId,
    items,
    tx,
    total,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  orders.unshift(newOrder);
  save(ORDERS_FILE, orders);

  used.push(tx);
  save(TX_FILE, used);

  return res.json({ ok: true, order: newOrder });
});

// admin: listar
app.get("/api/admin/orders", (req, res) => {
  if (req.headers["x-admin-token"] !== ADMIN_TOKEN)
    return res.status(403).json({ ok: false });
  res.json(load(ORDERS_FILE));
});

// admin: alterar status
app.put("/api/admin/orders/:id", (req, res) => {
  if (req.headers["x-admin-token"] !== ADMIN_TOKEN)
    return res.status(403).json({ ok: false });

  const orders = load(ORDERS_FILE);
  const o = orders.find((x) => x.id === req.params.id);
  if (!o) return res.json({ ok: false });

  o.status = req.body.status;
  save(ORDERS_FILE, orders);

  res.json({ ok: true });
});

app.listen(3000, () => console.log("Backend rodando na porta 3000"));
