(function () {
  if (!localStorage.getItem('foodgo_token')) {
    window.location.replace('login.html');
    return;
  }

  const API = (location.port === '8080') ? '/api' : 'http://localhost:4000/api';
  const SERVICE_RATE = 0.05;
  const FREE_DELIVERY_MIN = 25;

  const DELIVERY_ZONES = {
    'Valletta': 1.50,
    'Floriana': 1.50,
    'Hamrun': 1.80,
    'Sliema': 2.20,
    "St. Julian's": 2.40,
    'Msida': 2.20,
    'Gzira': 2.20,
    'Birkirkara': 2.80,
    'Qormi': 2.80,
    'Mosta': 3.20,
    'Paola': 2.90,
    'Other': 3.50
  };

  let cart = JSON.parse(localStorage.getItem('foodgo_cart') || '[]');
  let user = {};
  try { user = JSON.parse(localStorage.getItem('foodgo_user') || '{}'); } catch (e) {}

  function formatEUR(n) { return '\u20AC' + Number(n).toFixed(2); }

  function deliveryFeeForTown(town) {
    if (!town) return 0;
    return DELIVERY_ZONES[town] != null ? DELIVERY_ZONES[town] : DELIVERY_ZONES['Other'];
  }

  function calc() {
    const subtotal = cart.reduce(function (s, i) { return s + i.unit_price * i.quantity; }, 0);
    const town = (document.getElementById('town') || {}).value || '';
    let delivery = cart.length ? deliveryFeeForTown(town) : 0;
    if (subtotal >= FREE_DELIVERY_MIN) delivery = 0;
    const service = Math.round(subtotal * SERVICE_RATE * 100) / 100;
    const total = Math.round((subtotal + delivery + service) * 100) / 100;
    return { subtotal: subtotal, delivery: delivery, service: service, total: total, town: town };
  }

  function renderSummary() {
    const wrap = document.getElementById('checkoutWrap');
    if (!cart.length) {
      wrap.innerHTML = '<div class="empty" style="grid-column:1/-1">' +
        '<p>Your cart is empty.</p>' +
        '<p style="margin-top:12px"><a href="menu.html">Browse today\'s menu</a></p></div>';
      return;
    }
    document.getElementById('summaryItems').innerHTML = cart.map(function (c) {
      return '<div class="summary-item">' +
        '<div><div>' + c.quantity + '\u00D7 ' + c.name + '</div>' +
        '<div class="muted">' + (c.restaurant_name || '') + '</div></div>' +
        '<div>' + formatEUR(c.unit_price * c.quantity) + '</div></div>';
    }).join('');
    const t = calc();
    var delLabel = t.delivery === 0 && t.subtotal >= FREE_DELIVERY_MIN
      ? 'Free (orders over \u20AC' + FREE_DELIVERY_MIN + ')'
      : (t.town ? ('to ' + t.town) : 'select town');
    document.getElementById('summaryTotals').innerHTML =
      '<div class="total-row"><span>Subtotal</span><span>' + formatEUR(t.subtotal) + '</span></div>' +
      '<div class="total-row"><span>Delivery <span class="muted" style="font-size:0.75rem">(' + delLabel + ')</span></span><span>' + formatEUR(t.delivery) + '</span></div>' +
      '<div class="total-row"><span>Service (5%)</span><span>' + formatEUR(t.service) + '</span></div>' +
      '<div class="total-row grand"><span>Total</span><span>' + formatEUR(t.total) + '</span></div>';
  }

  if (user.name) {
    var n = document.getElementById('fullName');
    if (n && !n.value) n.value = user.name;
  }
  if (user.email) {
    var em = document.getElementById('email');
    if (em && !em.value) em.value = user.email;
  }
  if (user.phone) {
    var ph = document.getElementById('phone');
    if (ph && !ph.value) ph.value = user.phone;
  }

  var townEl = document.getElementById('town');
  if (townEl) townEl.addEventListener('change', renderSummary);

  document.getElementById('deliveryTime').addEventListener('change', function () {
    document.getElementById('scheduleField').style.display =
      this.value === 'scheduled' ? 'block' : 'none';
  });

  document.querySelectorAll('.pay-option').forEach(function (opt) {
    opt.addEventListener('click', function () {
      document.querySelectorAll('.pay-option').forEach(function (o) { o.classList.remove('selected'); });
      opt.classList.add('selected');
      opt.querySelector('input').checked = true;
    });
  });

  document.getElementById('checkoutForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const err = document.getElementById('formError');
    err.classList.remove('show');
    const btn = document.getElementById('placeBtn');

    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const street = document.getElementById('street').value.trim();
    const town = document.getElementById('town').value;
    const deliveryTime = document.getElementById('deliveryTime').value;
    const scheduleAt = document.getElementById('scheduleAt').value;
    const notes = document.getElementById('notes').value.trim();
    const payment = (document.querySelector('input[name="payment"]:checked') || {}).value || 'card';

    if (!fullName || !email || !phone || !street || !town) {
      err.textContent = 'Please fill in all required delivery details.';
      err.classList.add('show');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      err.textContent = 'Please enter a valid email address.';
      err.classList.add('show');
      return;
    }
    if (!cart.length) {
      err.textContent = 'Your cart is empty.';
      err.classList.add('show');
      return;
    }

    const restaurantId = cart[0].restaurant_id;
    const mixed = cart.some(function (c) { return c.restaurant_id !== restaurantId; });
    if (mixed) {
      err.textContent = 'Please order from one restaurant at a time.';
      err.classList.add('show');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Placing order\u2026';
    const t = calc();
    const orderRef = 'FG-' + Date.now().toString(36).toUpperCase();
    let apiOrderId = null;
    const token = localStorage.getItem('foodgo_token');

    try {
      if (token && restaurantId) {
        const orderRes = await fetch(API + '/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({
            restaurant_id: restaurantId,
            items: cart.map(function (c) {
              return { menu_item_id: c.menu_item_id, quantity: c.quantity };
            }),
            delivery_town: town,
            delivery_street: street,
            delivery_time: deliveryTime === 'scheduled' && scheduleAt ? scheduleAt : 'ASAP',
            payment_method: payment,
            notes: notes || undefined
          })
        });
        if (orderRes.ok) {
          const od = await orderRes.json();
          apiOrderId = od.order && (od.order.id || od.order.order_id);
        }
      }
    } catch (apiErr) {
      console.warn('API order skipped', apiErr);
    }

    const confirmation = {
      orderRef: apiOrderId || orderRef,
      fullName: fullName,
      email: email,
      phone: phone,
      street: street,
      town: town,
      deliveryTime: deliveryTime === 'scheduled' && scheduleAt ? scheduleAt : 'ASAP',
      payment: payment,
      items: cart.slice(),
      totals: t,
      createdAt: new Date().toISOString()
    };
    sessionStorage.setItem('foodgo_last_order', JSON.stringify(confirmation));
    localStorage.removeItem('foodgo_cart');
    window.location.href = 'thank-you.html';
  });

  renderSummary();
})();
