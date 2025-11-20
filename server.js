<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Miaw Store — Compra Segura</title>
  <style>
    body { margin:0; font-family:Arial; background:#1a001f; color:#eee; }
    header {padding:20px; text-align:center; font-size:36px;}
    .container {max-width:1000px; margin:auto; padding:20px;}
    .products {display:grid; grid-template-columns:repeat(auto-fit, minmax(220px,1fr)); gap:20px;}
    .card {background:rgba(255,255,255,0.08); padding:15px; border-radius:12px; text-align:center; transition:0.2s;}
    .card:hover {transform:translateY(-6px); background:rgba(255,255,255,0.12);}
    .card img {width:150px; height:150px; object-fit:contain;}
    .btn {margin-top:10px; padding:10px; border:none; border-radius:8px; cursor:pointer; background:purple; color:white;}
    #cart {margin-top:30px; background:rgba(255,255,255,0.1); padding:20px; border-radius:12px;}
    #checkout-modal {position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);display:none;align-items:center;justify-content:center;}
    #checkout-modal .modal-content {background:#2a002d;padding:20px;border-radius:12px;width:320px;}
    input {width:100%;padding:8px;margin-top:8px;border-radius:6px;border:none;}
  </style>
</head>
<body>
  <header>Miaw Store</header>
  <div class="container">
    <div class="products" id="product-list"></div>

    <div id="cart">
      <h3>Seu Carrinho</h3>
      <div id="cart-items"></div>
      <button class="btn" onclick="openCheckout()">Finalizar Compra</button>
    </div>
  </div>

  <div id="checkout-modal">
    <div class="modal-content">
      <h3>Verificação</h3>
      <input id="username" placeholder="Seu username Roblox">
      <input id="txid" placeholder="Transaction ID">
      <button class="btn" onclick="verify()">Verificar Pagamento</button>
      <button class="btn" onclick="closeCheckout()">Cancelar</button>
      <div id="msg" style="margin-top:10px; color:red;"></div>
    </div>
  </div>

  <script>
    const API = 'https://SEU_BACKEND_URL'; // coloca seu backend aqui
    const PRODUCTS = [
      {id:'tomatrio', name:'Tomatrio', price:50, img:'https://raw.githubusercontent.com/Luiz-altf4/Miaw-Store/main/assets/tomatrio.png'},
      {id:'mango', name:'Mango', price:50, img:'https://raw.githubusercontent.com/Luiz-altf4/Miaw-Store/main/assets/mango.png'},
      {id:'kinglimone', name:'King Limone', price:70, img:'https://raw.githubusercontent.com/Luiz-altf4/Miaw-Store/main/assets/kinglimone.png'},
      {id:'shrombino', name:'Shrombino', price:50, img:'https://raw.githubusercontent.com/Luiz-altf4/Miaw-Store/main/assets/shrombino.png'},
      {id:'starfruit', name:'Star Fruit', price:100, img:'https://raw.githubusercontent.com/Luiz-altf4/Miaw-Store/main/assets/starfruit.png'},
      {id:'mrcarrot', name:'Mr Carrot', price:50, img:'https://raw.githubusercontent.com/Luiz-altf4/Miaw-Store/main/assets/mrcarrot.png'}
    ];

    let cart = [];

    function renderCatalog(){
      const el = document.getElementById('product-list');
      PRODUCTS.forEach(p => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
          <img src="${p.img}" />
          <h4>${p.name}</h4>
          <p>${p.price} Robux</p>
          <button class="btn" onclick="addToCart('${p.id}')">Adicionar</button>
        `;
        el.appendChild(card);
      });
    }

    function addToCart(id){
      const p = PRODUCTS.find(x => x.id === id);
      cart.push(p);
      renderCart();
    }
    function renderCart(){
      const el = document.getElementById('cart-items');
      el.innerHTML = cart.map(c => `<div>${c.name} - ${c.price} RBX</div>`).join('');
    }

    function openCheckout(){
      document.getElementById('checkout-modal').style.display = 'flex';
    }
    function closeCheckout(){
      document.getElementById('checkout-modal').style.display = 'none';
      document.getElementById('msg').innerText = '';
    }

    async function verify(){
      const username = document.getElementById('username').value.trim();
      const tx = document.getElementById('txid').value.trim();
      if(!username || !tx) return document.getElementById('msg').innerText = 'Preencha username e TX';

      const total = cart.reduce((s,i)=>s+i.price, 0);
      const resp = await fetch(API + '/api/verify', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ username, tx, total, items: cart })
      });
      const j = await resp.json();
      if(!j.ok) return document.getElementById('msg').innerText = 'Erro: ' + j.error;
      alert('Compra confirmada! ID do pedido: ' + j.orderId);
      cart = [];
      renderCart();
      closeCheckout();
    }

    renderCatalog();
    renderCart();
  </script>
</body>
</html>
