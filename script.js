const productData = {
  plain: {
    id: "plain",
    title: "Classic Plain Makhana",
    price: 399,
    hoverImage: "./assets/plain_hover.png",
    image: "./assets/plain.png",
    ingredients: "Premium Grade Fox Nuts (Makhana)."
  },
  salted: {
    id: "salted",
    title: "Lightly Salted Makhana",
    price: 399,
    hoverImage: "./assets/salted_hover.png",
    image: "./assets/salted.png",
    ingredients: "Premium Grade Fox Nuts (Makhana), Himalayan Pink Salt, Rice Bran Oil."
  },
  periperi: {
    id: "periperi",
    title: "Fiery Peri-Peri Makhana",
    price: 399,
    hoverImage: "./assets/periperi_hover.png",
    image: "./assets/periperi.png",
    ingredients: "Premium Grade Fox Nuts (Makhana), Peri-Peri Spice Blend, Rice Bran Oil."
  },
  combo: {
    id: "combo",
    title: "The Ultimate Combo Pack",
    price: 899,
    hoverImage: "./assets/combo_hover.png",
    image: "./assets/combo.png",
    ingredients: "Contains Plain, Salted, and Peri-Peri 200g Packs."
  }
};

const API_BASE_URL = 'http://localhost:3001';

// Cart State Management
let cart = JSON.parse(localStorage.getItem('veyano_cart')) || [];

function saveCart() {
  localStorage.setItem('veyano_cart', JSON.stringify(cart));
  updateCartUI();
}

function updateCartUI() {
  const cartCount = document.getElementById('cart-count');
  const cartItemsContainer = document.getElementById('cart-items-container');
  const subtotalEl = document.getElementById('cart-subtotal');
  const deliveryEl = document.getElementById('cart-delivery');
  const totalEl = document.getElementById('cart-total');

  // Update Badge Count
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  if(cartCount) cartCount.textContent = totalItems;

  if(!cartItemsContainer) return;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = '<div class="cart-empty">Your cart is empty.</div>';
    if(subtotalEl) subtotalEl.textContent = '₹0';
    if(deliveryEl) deliveryEl.textContent = '₹0';
    if(totalEl) totalEl.textContent = '₹0';
    return;
  }

  let subtotal = 0;
  cartItemsContainer.innerHTML = '';

  cart.forEach(item => {
    subtotal += item.price * item.quantity;
    const itemEl = document.createElement('div');
    itemEl.className = 'cart-item';
    itemEl.innerHTML = `
      <img src="${item.image}" class="cart-item-img">
      <div class="cart-item-info">
        <div class="cart-item-title">${item.title}</div>
        <div class="cart-item-price">₹${item.price}</div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="window.updateQty('${item.id}', -1)">-</button>
          <span>${item.quantity}</span>
          <button class="qty-btn" onclick="window.updateQty('${item.id}', 1)">+</button>
          <button class="qty-btn" style="margin-left:auto; border:none; color:red;" onclick="window.removeCartItem('${item.id}')">✕</button>
        </div>
      </div>
    `;
    cartItemsContainer.appendChild(itemEl);
  });

  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
  const deliveryFee = subtotal >= 499 ? 0 : 50;
  const codFee = paymentMethod === 'cod' ? 99 : 0;
  const total = subtotal + deliveryFee + codFee;

  if(subtotalEl) subtotalEl.textContent = `₹${subtotal}`;
  if(deliveryEl) deliveryEl.textContent = subtotal >= 499 ? 'FREE' : `₹${deliveryFee}`;
  if(totalEl) totalEl.textContent = `₹${total}`;
}

window.updateQty = (id, delta) => {
  const item = cart.find(i => i.id === id);
  if (item) {
    item.quantity += delta;
    if (item.quantity <= 0) {
      cart = cart.filter(i => i.id !== id);
    }
    saveCart();
  }
};

window.removeCartItem = (id) => {
  cart = cart.filter(i => i.id !== id);
  saveCart();
};

window.addToCart = (id) => {
  const product = productData[id];
  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }
  saveCart();
  toggleCart(true);
};

// Auth State Management
let currentUser = JSON.parse(localStorage.getItem('veyano_user')) || null;
let authToken = localStorage.getItem('veyano_token') || null;

function toggleCart(open) {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  if(!drawer || !overlay) return;
  
  if(open) {
    drawer.classList.add('open');
    overlay.classList.add('open');
    updateUserUI();
  } else {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    // Reset to step 1 when closing
    goToStep(1);
  }
}

function updateUserUI() {
  const container = document.getElementById('cart-drawer-body');
  let profileBar = document.querySelector('.user-profile-bar');
  
  if (currentUser && authToken) {
    if (!profileBar) {
      profileBar = document.createElement('div');
      profileBar.className = 'user-profile-bar';
      container.prepend(profileBar);
    }
    profileBar.innerHTML = `
      <span>Hi, ${currentUser.name}</span>
      <span class="logout-btn" onclick="window.logout()">Logout</span>
    `;
    // Pre-fill shipping if available
    const shipName = document.getElementById('ship-name');
    const shipEmail = document.getElementById('ship-email');
    if (shipName && !shipName.value) shipName.value = currentUser.name;
    if (shipEmail && !shipEmail.value) shipEmail.value = currentUser.email;
  } else {
    if (profileBar) profileBar.remove();
  }
}

window.logout = () => {
  localStorage.removeItem('veyano_user');
  localStorage.removeItem('veyano_token');
  currentUser = null;
  authToken = null;
  updateUserUI();
  goToStep(1);
};

// Checkout Step Navigation (4 Steps)
function goToStep(step) {
  const step1 = document.getElementById('cart-step-items');
  const step2 = document.getElementById('cart-step-auth');
  const step3 = document.getElementById('cart-step-shipping');
  const step4 = document.getElementById('cart-step-success');
  
  const nextBtn = document.getElementById('next-step-btn');
  const actions = document.getElementById('checkout-actions');
  const summary = document.getElementById('summary-section');

  // Hide all
  [step1, step2, step3, step4].forEach(s => { if(s) s.style.display = 'none'; });

  if (step === 1) {
    step1.style.display = 'block';
    nextBtn.style.display = 'block';
    nextBtn.textContent = 'Proceed to Checkout';
    actions.style.display = 'none';
    summary.style.display = 'block';
  } else if (step === 2) {
    step2.style.display = 'block';
    nextBtn.style.display = 'none';
    actions.style.display = 'none'; // Hidden until logged in
    summary.style.display = 'block';
  } else if (step === 3) {
    step3.style.display = 'block';
    nextBtn.style.display = 'none';
    actions.style.display = 'flex';
    summary.style.display = 'block';
  } else if (step === 4) {
    step4.style.display = 'block';
    nextBtn.style.display = 'none';
    actions.style.display = 'none';
    summary.style.display = 'none';
  }
}

// Auth Handlers
async function handleAuth(type, e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button');
  const originalText = submitBtn.textContent;
  
  submitBtn.disabled = true;
  submitBtn.textContent = 'Please wait...';

  const data = type === 'login' 
    ? { email: form[0].value, password: form[1].value }
    : { name: form[0].value, email: form[1].value, password: form[2].value };

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Authentication failed');

    authToken = result.token;
    currentUser = result.user;
    localStorage.setItem('veyano_token', authToken);
    localStorage.setItem('veyano_user', JSON.stringify(currentUser));
    
    updateUserUI();
    goToStep(3); // Go to shipping
  } catch (err) {
    alert(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// Backend Order Integration
async function placeOrder() {
  const form = document.getElementById('checkout-form');
  if (!form.checkValidity()) {
    return form.reportValidity();
  }

  // Double check login
  if (!authToken) return goToStep(2);

  const placeBtn = document.getElementById('place-order-btn');
  placeBtn.disabled = true;
  placeBtn.textContent = 'Processing...';

  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
  
  const orderData = {
    customerName: document.getElementById('ship-name').value,
    customerEmail: document.getElementById('ship-email').value,
    customerPhone: document.getElementById('ship-phone').value,
    shippingAddress: document.getElementById('ship-address').value,
    shippingCity: document.getElementById('ship-city').value,
    shippingState: document.getElementById('ship-state').value,
    shippingPincode: document.getElementById('ship-pincode').value,
    paymentMethod: paymentMethod,
    items: cart.map(item => ({
      sku: item.id,
      productName: item.title,
      quantity: item.quantity,
      unitPrice: item.price
    }))
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(orderData)
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to place order');

    if (paymentMethod === 'cod') {
      showSuccess(result.orderNumber);
    } else {
      initiateRazorpay(result);
    }
  } catch (err) {
    alert(err.message);
  } finally {
    placeBtn.disabled = false;
    placeBtn.textContent = 'Place Order';
  }
}

function initiateRazorpay(orderResult) {
  const options = {
    "key": orderResult.razorpayKeyId,
    "amount": orderResult.totalAmount * 100,
    "currency": "INR",
    "name": "Veyano Foods",
    "description": "Order #" + orderResult.orderNumber,
    "order_id": orderResult.razorpayOrderId,
    "handler": function (response) {
      showSuccess(orderResult.orderNumber);
    },
    "prefill": {
      "name": document.getElementById('ship-name').value,
      "email": document.getElementById('ship-email').value,
      "contact": document.getElementById('ship-phone').value
    },
    "theme": { "color": "#c08b5c" }
  };
  const rzp = new window.Razorpay(options);
  rzp.open();
}

function showSuccess(orderNumber) {
  const display = document.getElementById('order-number-display');
  if(display) display.textContent = `Order #${orderNumber}`;
  goToStep(4);
  cart = [];
  saveCart();
}

document.addEventListener('DOMContentLoaded', () => {
  // Page specific logic (Product Details)
  const urlParams = new URLSearchParams(window.location.search);
  let variant = urlParams.get('variant');
  const path = window.location.pathname;

  if (path.includes('product.html') || urlParams.has('variant')) {
    if (!variant || !productData[variant]) variant = 'plain';
    
    const mainImage = document.getElementById('main-product-image');
    const hoverImage = document.getElementById('hover-product-image');
    const productTitle = document.getElementById('product-title');
    const productPriceEl = document.getElementById('product-price');
    const ingredientsText = document.getElementById('ingredients-text');
    const variantBtns = document.querySelectorAll('.variant-btn');

    function updatePageContent(v) {
      const data = productData[v];
      if(mainImage) {
          mainImage.style.opacity = '0';
          setTimeout(() => {
            mainImage.src = data.image;
            mainImage.style.opacity = '1';
            if(hoverImage) hoverImage.src = data.hoverImage;
          }, 200);
      }
      if(productTitle) productTitle.textContent = data.title;
      if(productPriceEl) productPriceEl.innerHTML = `₹${data.price} <span style="font-size:0.9rem; color:#666;">(${v === 'combo' ? '3 x 200g' : '200g'})</span>`;
      if(ingredientsText) ingredientsText.textContent = data.ingredients;

      variantBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.variant === v) btn.classList.add('active');
      });
    }

    updatePageContent(variant);
    variantBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const v = e.target.dataset.variant;
        variant = v;
        updatePageContent(v);
        const newurl = window.location.pathname + '?variant=' + v;
        window.history.replaceState({path:newurl},'',newurl);
      });
    });

    document.getElementById('add-to-cart-btn')?.addEventListener('click', () => {
        window.addToCart(variant);
    });
  }

  // Cart Listeners
  document.getElementById('cart-icon-btn')?.addEventListener('click', () => toggleCart(true));
  document.getElementById('close-cart-btn')?.addEventListener('click', () => toggleCart(false));
  document.getElementById('cart-overlay')?.addEventListener('click', () => toggleCart(false));

  // Checkout Step Listeners
  document.getElementById('next-step-btn')?.addEventListener('click', () => {
    if (cart.length === 0) return alert("Your cart is empty!");
    
    if (!authToken) {
      goToStep(2); // Force Login/Register
    } else {
      goToStep(3); // Already logged in, go to shipping
    }
  });

  document.getElementById('back-to-cart-btn')?.addEventListener('click', () => {
    goToStep(1);
  });

  document.getElementById('place-order-btn')?.addEventListener('click', placeOrder);

  // Auth Tab Logic
  document.getElementById('tab-login')?.addEventListener('click', () => {
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-signup').classList.remove('active');
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('signup-form').style.display = 'none';
  });

  document.getElementById('tab-signup')?.addEventListener('click', () => {
    document.getElementById('tab-signup').classList.add('active');
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('signup-form').style.display = 'block';
    document.getElementById('login-form').style.display = 'none';
  });

  document.getElementById('login-form')?.addEventListener('submit', (e) => handleAuth('login', e));
  document.getElementById('signup-form')?.addEventListener('submit', (e) => handleAuth('register', e));

  // COD logic UI
  document.querySelectorAll('input[name="paymentMethod"]').forEach(input => {
    input.addEventListener('change', (e) => {
      const codRow = document.getElementById('cod-fee-row');
      if (e.target.value === 'cod') {
        codRow.style.display = 'flex';
      } else {
        codRow.style.display = 'none';
      }
      updateCartUI();
    });
  });

  updateCartUI();
});
