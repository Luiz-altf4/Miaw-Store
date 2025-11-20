// server.js
// Node/Express backend for Miaw Store — simple file DB + Roblox verification
const express = require('express');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // if Node 18+, can use global fetch
const bodyParser = require('body-parser');
const cors = require('cors');

const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const TXS_FILE = path.join(DATA_DIR, 'usedTx.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, JSON.stringify([]));
if (!fs.existsSync(TXS_FILE)) fs.writeFileSync(TXS_FILE, JSON.stringify([]));

const app = express();
app.use(cors());
app.use(bodyParser.json());

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'troca_esse_token_agora'; // use env var in prod

// Gamepass mapping by total price (same que no frontend)
const GAMEPASSES = {
  50: '1591926519',
  70: '1593857095',
  100: '1591582593',
  200: '1594232992'
};

function readOrders(){ return JSON.parse(fs.readFileSync(ORDERS_FILE,'utf8')||'[]'); }
function writeOrders(data){ fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2)); }
function readTxs(){ return JSON.parse(fs.readFileSync(TXS_FILE,'utf8')||'[]'); }
function writeTxs(data){ fs.writeFileSync(TXS_FILE, JSON.stringify(data, null, 2)); }

/**
 * Helper: get Roblox userId from username
 * Uses users.roblox.com/v1/usernames/users (POST) - recommended
 */
async function getUserIdFromUsername(username){
  const res = await fetch('https://users.roblox.com/v1/usernames/users', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: true })
  });
  if(!res.ok) return null;
  const json = await res.json();
  if(!json || !json.data || json.data.length===0) return null;
  return json.data[0].id;
}

/**
 * Helper: check if user owns gamepass
 * Uses inventory.roblox.com/v1/users/{userId}/items/GamePass/{gamePassId}
 * Returns true if non-empty
 */
async function checkUserOwnsGamepass(userId, gamepassId){
  const url = `https://inventory.roblox.com/v1/users/${userId}/items/GamePass/${gamepassId}`;
  const res = await fetch(url, { method:'GET' });
  if(!res.ok){
    // some endpoints may return 404 / 500 - treat as not owning, but log
    return false;
  }
  const json = await res.json();
  // If data array exists and not empty => owns
  if(json && Array.isArray(json.data) && json.data.length > 0) return true;
  // Some endpoints return a different shape - try fallback:
  if(json && json.total && json.total > 0) return true;
  return false;
}

/**
 * POST /api/verify
 * body: { username, tx, items: [{id,name,price,qty}], total }
 * verifies that user owns the appropriate gamepass (by total)
 * checks tx not used
 * saves order to orders.json
 */
app.post('/api/verify', async (req, res) => {
  try{
    const { username, tx, items, total } = req.body;
    if(!username || !tx || !Array.isArray(items) || !total) return res.status(400).json({ ok:false, error:'missing_fields' });

    // check tx duplicate
    const used = readTxs();
    if(used.includes(tx)) return res.status(409).json({ ok:false, error:'tx_used' });

    // get gamepass id by total
    const gpId = GAMEPASSES[total];
    if(!gpId) return res.status(400).json({ ok:false, error:'invalid_total' });

    // convert username -> userId
    const userId = await getUserIdFromUsername(username);
    if(!userId) return res.status(404).json({ ok:false, error:'username_not_found' });

    // check ownership
    const owns = await checkUserOwnsGamepass(userId, gpId);
    if(!owns) return res.status(402).json({ ok:false, error:'not_paid' });

    // ok — save order
    const orders = readOrders();
    const order = {
      id: 'ord_' + Date.now(),
      username, userId,
      items, total, tx, createdAt: new Date().toISOString(), status: 'pending'
    };
    orders.unshift(order);
    writeOrders(orders);

    // save tx
    used.push(tx); writeTxs(used);

    return res.json({ ok:true, orderId: order.id });
  }catch(err){
    console.error('verify error', err);
    return res.status(500).json({ ok:false, error:'server_error' });
  }
});

/**
 * Admin routes
 * GET /api/orders -> list (auth by ADMIN_TOKEN header)
 * PUT /api/orders/:id -> update status (body: { status })
 * DELETE /api/orders/:id
 * GET /api/export -> CSV download
 */
function requireAdmin(req,res,next){
  const token = req.headers['x-admin-token'] || req.query.token;
  if(!token || token !== ADMIN_TOKEN) return res.status(401).json({ ok:false, error:'unauthorized' });
  next();
}

app.get('/api/orders', requireAdmin, (req,res) => {
  const orders = readOrders();
  res.json({ ok:true, orders });
});

app.put('/api/orders/:id', requireAdmin, (req,res) => {
  const id = req.params.id;
  const { status } = req.body;
  const orders = readOrders();
  const o = orders.find(x => x.id === id);
  if(!o) return res.status(404).json({ ok:false, error:'not_found' });
  o.status = status || o.status;
  writeOrders(orders);
  res.json({ ok:true, order: o });
});

app.delete('/api/orders/:id', requireAdmin, (req,res) => {
  const id = req.params.id;
  let orders = readOrders();
  orders = orders.filter(x => x.id !== id);
  writeOrders(orders);
  res.json({ ok:true });
});

app.get('/api/export', requireAdmin, (req,res) => {
  const orders = readOrders();
  const rows = orders.map(o => {
    const items = o.items.map(i => `${i.qty}x ${i.name}`).join('; ');
    return `"${o.id}","${o.username}","${o.userId}","${items}","${o.total}","${o.tx}","${o.status}","${o.createdAt}"`;
  });
  const header = '"id","username","userId","items","total","tx","status","createdAt"\\n';
  res.setHeader('Content-Type','text/csv');
  res.setHeader('Content-Disposition','attachment; filename=miaw_orders.csv');
  res.send(header + rows.join('\\n'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Miaw-backend running on', PORT));
