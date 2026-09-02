(function () {
  if (!localStorage.getItem('foodgo_token')) {
    window.location.replace('login.html');
    return;
  }

  const API = (location.port === '8080') ? '/api' : 'http://localhost:4000/api';
  const CATEGORY_IMAGES = {
    'Pizza': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop&q=80',
    'Burgers': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop&q=80',
    'Maltese food': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop&q=80',
    'Sushi': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=300&fit=crop&q=80',
    'Healthy bowls': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop&q=80',
    'Desserts': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&h=300&fit=crop&q=80'
  };

  let restaurants = [];
  let cart = JSON.parse(localStorage.getItem('foodgo_cart') || '[]');

  function logout() {
    localStorage.removeItem('foodgo_token');
    localStorage.removeItem('foodgo_user');
    localStorage.removeItem('foodgo_cart');
    window.location.href = 'login.html';
  }

  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function saveCart() {
    localStorage.setItem('foodgo_cart', JSON.stringify(cart));
    const n = cart.reduce(function (s, i) { return s + i.quantity; }, 0);
    const badge = document.getElementById('cartCount');
    if (badge) {
      badge.textContent = n;
      badge.classList.toggle('show', n > 0);
    }
  }

  function addToCart(item, restaurantId, restaurantName) {
    const existing = cart.find(function (c) { return c.menu_item_id === item.id; });
    if (existing) existing.quantity += 1;
    else cart.push({
      menu_item_id: item.id,
      name: item.name,
      unit_price: item.price,
      quantity: 1,
      restaurant_id: restaurantId,
      restaurant_name: restaurantName
    });
    saveCart();
    toast(item.name + ' added to cart');
  }

  function formatEUR(n) {
    return '\u20AC' + Number(n).toFixed(2);
  }

  function renderRestaurants(list) {
    const grid = document.getElementById('restGrid');
    if (!grid) return;
    if (!list.length) {
      grid.innerHTML = '<div class="api-status">No restaurants found.</div>';
      return;
    }
    grid.innerHTML = list.map(function (r) {
      return '<article class="rest-card" data-id="' + r.id + '">' +
        '<div class="rest-card-top">' +
          '<span class="rest-badge">' + r.category + '</span>' +
          '<span>' + (r.name || '?')[0] + '</span>' +
        '</div>' +
        '<div class="rest-body">' +
          '<div class="rest-name">' + r.name + '</div>' +
          '<div class="rest-meta">' + (r.town || 'Malta') + ' \u00B7 ' + r.category + '</div>' +
          '<div class="rest-desc">' + (r.description || '') + '</div>' +
          '<div class="rest-fee">Delivery from ' + formatEUR(r.delivery_fee) + '</div>' +
        '</div></article>';
    }).join('');
    grid.querySelectorAll('.rest-card').forEach(function (card) {
      card.addEventListener('click', function () { openMenu(card.dataset.id); });
    });
  }

  function buildFilters(list) {
    const cats = [];
    list.forEach(function (r) {
      if (cats.indexOf(r.category) === -1) cats.push(r.category);
    });
    cats.sort();
    const row = document.getElementById('categoryFilters');
    if (!row) return;
    row.innerHTML = '<button class="filter-chip active" data-cat="">All</button>' +
      cats.map(function (c) {
        return '<button class="filter-chip" data-cat="' + c + '">' + c + '</button>';
      }).join('');
    row.querySelectorAll('.filter-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        row.querySelectorAll('.filter-chip').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        const cat = btn.dataset.cat;
        renderRestaurants(cat ? restaurants.filter(function (r) { return r.category === cat; }) : restaurants);
      });
    });
  }

  async function openMenu(id) {
    const modal = document.getElementById('menuModal');
    const body = document.getElementById('modalBody');
    document.getElementById('modalTitle').textContent = 'Loading\u2026';
    document.getElementById('modalSub').textContent = '';
    body.innerHTML = '<div class="api-status">Loading menu\u2026</div>';
    modal.classList.add('open');
    try {
      const res = await fetch(API + '/restaurants/' + id);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const r = data.restaurant;
      const menu = data.menu || [];
      document.getElementById('modalTitle').textContent = r.name;
      document.getElementById('modalSub').textContent =
        (r.town || '') + ' \u00B7 Delivery from ' + formatEUR(r.delivery_fee);
      if (!menu.length) {
        body.innerHTML = '<div class="api-status">No dishes available.</div>';
        return;
      }
      body.innerHTML = menu.map(function (item) {
        return '<div class="menu-item"><div>' +
          '<div class="menu-item-name">' + item.name + '</div>' +
          '<div class="menu-item-desc">' + (item.description || item.category || '') + '</div>' +
          '</div><div class="menu-item-right">' +
          '<span class="menu-item-price">' + formatEUR(item.price) + '</span>' +
          '<button class="add-btn" type="button" data-id="' + item.id + '" aria-label="Add">+</button>' +
          '</div></div>';
      }).join('') +
        '<div style="margin-top:16px;text-align:center">' +
        '<a href="checkout.html" class="btn-solid" style="display:inline-flex;text-decoration:none">Go to checkout</a></div>';
      body.querySelectorAll('.add-btn').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          const item = menu.find(function (m) { return m.id === btn.dataset.id; });
          if (item) addToCart(item, r.id, r.name);
        });
      });
    } catch (err) {
      body.innerHTML = '<div class="api-status error">Could not load menu.</div>';
    }
  }

  function closeModal() {
    document.getElementById('menuModal').classList.remove('open');
  }

  async function loadPopularPicks() {
    const track = document.querySelector('.picks-track');
    if (!track) return;
    try {
      const picks = [];
      for (let i = 0; i < Math.min(4, restaurants.length); i++) {
        const r = restaurants[i];
        const res = await fetch(API + '/restaurants/' + r.id);
        if (!res.ok) continue;
        const data = await res.json();
        (data.menu || []).filter(function (m) { return m.price >= 8; }).slice(0, 1).forEach(function (m) {
          picks.push({
            id: m.id, name: m.name, price: m.price,
            restaurant_id: r.id, restaurant_name: r.name, category: r.category
          });
        });
      }
      if (!picks.length) {
        track.innerHTML = '<div class="api-status">No dishes yet.</div>';
        return;
      }
      track.innerHTML = picks.map(function (p) {
        const img = CATEGORY_IMAGES[p.category] || CATEGORY_IMAGES['Pizza'];
        return '<div class="pick-card" data-rest="' + p.restaurant_id + '">' +
          '<div class="pick-img" style="background-image:url(\'' + img + '\')"></div>' +
          '<div class="pick-body">' +
          '<div class="pick-name">' + p.name + '</div>' +
          '<div class="pick-desc">' + p.restaurant_name + '</div>' +
          '<div class="pick-row">' +
          '<span class="pick-price">' + formatEUR(p.price) + '</span>' +
          '<button class="pick-cart" type="button" data-id="' + p.id + '" data-rest="' + p.restaurant_id +
          '" data-rname="' + p.restaurant_name + '" data-name="' + p.name + '" data-price="' + p.price + '">' +
          '<svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>' +
          '</button></div></div></div>';
      }).join('');
      track.querySelectorAll('.pick-cart').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          addToCart({
            id: btn.dataset.id, name: btn.dataset.name, price: parseFloat(btn.dataset.price)
          }, btn.dataset.rest, btn.dataset.rname);
        });
      });
      track.querySelectorAll('.pick-card').forEach(function (card) {
        card.addEventListener('click', function (e) {
          if (e.target.closest('.pick-cart')) return;
          openMenu(card.dataset.rest);
        });
      });
    } catch (e) {
      track.innerHTML = '<div class="api-status error">Could not load dishes.</div>';
    }
  }

  async function init() {
    saveCart();
    var user = {};
    try { user = JSON.parse(localStorage.getItem('foodgo_user') || '{}'); } catch (e) {}
    var navAuth = document.getElementById('navAuth');
    if (navAuth) {
      navAuth.textContent = user.name ? ('Hi, ' + String(user.name).split(' ')[0]) : 'Sign out';
      navAuth.addEventListener('click', function (e) { e.preventDefault(); logout(); });
    }
    var footerLogout = document.getElementById('footerLogout');
    if (footerLogout) footerLogout.addEventListener('click', function (e) { e.preventDefault(); logout(); });

    const grid = document.getElementById('restGrid');
    try {
      const res = await fetch(API + '/restaurants');
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      restaurants = data.restaurants || [];
      buildFilters(restaurants);
      renderRestaurants(restaurants);
      loadPopularPicks();
    } catch (err) {
      if (grid) grid.innerHTML = '<div class="api-status error">Cannot reach the API. Start backend or Docker.</div>';
      var track = document.querySelector('.picks-track');
      if (track) track.innerHTML = '<div class="api-status error">API offline</div>';
    }
  }

  var modalClose = document.getElementById('modalClose');
  if (modalClose) modalClose.addEventListener('click', closeModal);
  var menuModal = document.getElementById('menuModal');
  if (menuModal) menuModal.addEventListener('click', function (e) {
    if (e.target.id === 'menuModal') closeModal();
  });

  var orderNow = document.getElementById('orderNowBtn');
  if (orderNow) orderNow.addEventListener('click', function (e) {
    e.preventDefault();
    window.location.href = 'menu.html';
  });
  var viewFull = document.getElementById('viewFullMenu');
  if (viewFull) viewFull.addEventListener('click', function () {
    window.location.href = 'menu.html';
  });
  var cartBtn = document.getElementById('cartBtn');
  if (cartBtn) cartBtn.addEventListener('click', function (e) {
    if (!cart.length) {
      e.preventDefault();
      toast('Your cart is empty. Add dishes from the menu.');
    }
  });

  document.querySelectorAll('.btn-solid').forEach(function (btn) {
    var t = btn.textContent || '';
    if (t.indexOf('Explore Menu') !== -1) {
      btn.addEventListener('click', function () { window.location.href = 'menu.html'; });
    }
    if (t.indexOf('Learn More') !== -1) {
      btn.addEventListener('click', function () {
        var about = document.querySelector('.about');
        if (about) about.scrollIntoView({ behavior: 'smooth' });
      });
    }
  });
  document.querySelectorAll('.btn-outline').forEach(function (btn) {
    if ((btn.textContent || '').indexOf('Our Story') !== -1) {
      btn.addEventListener('click', function () {
        var about = document.querySelector('.about');
        if (about) about.scrollIntoView({ behavior: 'smooth' });
      });
    }
  });

  var newsletterBtn = document.querySelector('.newsletter button');
  if (newsletterBtn) {
    newsletterBtn.addEventListener('click', function () {
      var input = document.querySelector('.newsletter input');
      var v = input && input.value.trim();
      if (!v || v.indexOf('@') === -1) {
        toast('Enter a valid email to subscribe');
        return;
      }
      toast('Thanks — you are on the list');
      if (input) input.value = '';
    });
  }

  var navToggle = document.querySelector('.nav-toggle');
  if (navToggle) {
    navToggle.addEventListener('click', function () {
      var links = document.querySelector('.nav-links');
      if (links) links.classList.toggle('open');
    });
  }

  init();
})();
