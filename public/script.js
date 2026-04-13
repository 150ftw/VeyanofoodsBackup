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

let clerk = null;
const CLERK_PUBLISHABLE_KEY = 'pk_test_cG9ldGljLWJ1enphcmQtMjcuY2xlcmsuYWNjb3VudHMuZGV2JA';

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

const API_BASE_URL = 'http://localhost:3001';

// Cart State Management
let cart = JSON.parse(localStorage.getItem('veyano_cart')) || [];
let currentUser = null;

async function saveCart() {
  localStorage.setItem('veyano_cart', JSON.stringify(cart));
  // Cart persistence is currently handled via localStorage
  updateCartUI();
}

async function fetchUserCart() {
  // Currently relying on localStorage for cart persistence
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

  // Calculate Fees
  const subtotalVal = subtotal;
  const deliveryFee = subtotalVal >= 499 ? 0 : 50;
  
  const paymentInput = document.querySelector('input[name="paymentMethod"]:checked');
  const paymentMethod = paymentInput ? paymentInput.value : 'cod'; 
  const codFee = paymentMethod === 'cod' ? 79 : 0;
  
  const total = subtotalVal + deliveryFee + codFee;

  // Update Display
  if(subtotalEl) subtotalEl.textContent = `₹${subtotalVal}`;
  if(deliveryEl) deliveryEl.textContent = subtotalVal >= 499 ? 'FREE' : `₹${deliveryFee}`;
  
  const codSummaryRow = document.getElementById('cod-fee-row-summary');
  const codSummaryDisplay = document.getElementById('cart-cod-fee');
  const incentiveMsg = document.getElementById('checkout-incentive-msg');
  
  if (codSummaryRow && codSummaryDisplay) {
    if (codFee > 0) {
      codSummaryRow.style.display = 'flex';
      codSummaryDisplay.textContent = `₹${codFee}`;
    } else {
      codSummaryRow.style.display = 'none';
    }
  }

  if (incentiveMsg) {
    if (paymentMethod === 'cod') {
      incentiveMsg.style.display = 'block';
      const potentialSavings = deliveryFee + codFee;
      const savingsBreakdown = deliveryFee > 0 ? '(Shipping + COD fees)' : '(COD fee)';
      incentiveMsg.innerHTML = `Save <strong>₹${potentialSavings}</strong> ${savingsBreakdown} by paying online now!`;
    } else {
      incentiveMsg.style.display = 'none';
    }
  }

  if(totalEl) totalEl.textContent = `₹${total}`;
}

window.updateQty = (id, delta) => {
  const itemIndex = cart.findIndex(i => i.id === id);
  if (itemIndex !== -1) {
    cart[itemIndex].quantity += delta;
    if (cart[itemIndex].quantity <= 0) {
      cart.splice(itemIndex, 1);
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

// Auth State Management (Clerk)
async function initClerk() {
  if (window.Clerk) {
    clerk = window.Clerk;
    try {
      await clerk.load();
      console.log('Clerk loaded successfully');
      
      clerk.addListener(({ user }) => {
        currentUser = user;
        updateAuthUI(user);
        updateCartUI();
        if (user) {
          syncUserWithBackend();
        }
      });

      // Initial check
      if (clerk.user) {
        currentUser = clerk.user;
        updateAuthUI(clerk.user);
        syncUserWithBackend();
      } else {
        mountClerkSignIn();
      }
    } catch (err) {
      console.error('Error loading Clerk:', err);
    }
  } else {
     setTimeout(initClerk, 100);
  }
}

function updateAuthUI(user) {
  const authContainer = document.getElementById('clerk-auth-container');
  const profileBar = document.getElementById('user-profile-bar');
  const userNameDisplay = document.getElementById('user-name-display');

  console.log('updateAuthUI called with user:', user);

  if (user && typeof user === 'object' && (user.id || user.fullName)) {
    if (authContainer) authContainer.style.display = 'none';
    if (profileBar) profileBar.style.display = 'flex';
    
    // Robust name falling back from FullName -> First/Last -> Email -> 'User'
    let displayName = user.fullName;
    if (!displayName && user.firstName) {
      displayName = user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName;
    }
    if (!displayName && user.primaryEmailAddress) {
      displayName = user.primaryEmailAddress.emailAddress;
    }
    if (!displayName) displayName = 'Logged In';

    console.log('Setting Display Name to:', displayName);
    if (userNameDisplay) userNameDisplay.textContent = displayName;

    // Pre-fill Shipping Details
    const shipName = document.getElementById('ship-name');
    const shipEmail = document.getElementById('ship-email');
    const shipPhone = document.getElementById('ship-phone');

    if (shipName && !shipName.value) shipName.value = user.fullName || user.firstName || '';
    if (shipEmail && !shipEmail.value) shipEmail.value = user.primaryEmailAddress?.emailAddress || '';
    if (shipPhone && !shipPhone.value) shipPhone.value = user.primaryPhoneNumber?.phoneNumber || '';

  } else {
    // No valid user object
    if (authContainer) authContainer.style.display = 'block';
    if (profileBar) profileBar.style.display = 'none';
    mountClerkSignIn();
  }
}

function mountClerkSignIn() {
  const container = document.getElementById('clerk-auth-container');
  if (container && clerk && !clerk.user) {
    clerk.mountSignIn(container, {
      appearance: {
        elements: {
          rootBox: { width: '100%' },
          card: { boxShadow: 'none', border: '1px solid #eee' }
        }
      }
    });
  }
}

async function syncUserWithBackend() {
  if (!clerk || !clerk.session) return;
  try {
    const token = await clerk.session.getToken();
    await fetch(`${API_BASE_URL}/api/auth/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    console.error('Error syncing user:', err);
  }
}

function toggleCart(open) {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  if(!drawer || !overlay) return;
  
  if(open) {
    drawer.classList.add('open');
    overlay.classList.add('open');
  } else {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    goToStep(1);
  }
}

function goToStep(step) {
  const step1 = document.getElementById('cart-step-items');
  const step2 = document.getElementById('cart-step-shipping');
  const step3 = document.getElementById('cart-step-success');
  
  const nextBtn = document.getElementById('next-step-btn');
  const actions = document.getElementById('checkout-actions');
  const summary = document.getElementById('summary-section');

  [step1, step2, step3].forEach(s => { if(s) s.style.display = 'none'; });

  if (step === 1) {
    if(step1) step1.style.display = 'block';
    if(nextBtn) {
      nextBtn.style.display = 'block';
      nextBtn.textContent = 'Proceed to Checkout';
    }
    if(actions) actions.style.display = 'none';
    if(summary) summary.style.display = 'block';
  } else if (step === 2) {
    if(step2) step2.style.display = 'block';
    if(nextBtn) nextBtn.style.display = 'none';
    if(actions) actions.style.display = 'flex';
    if(summary) summary.style.display = 'block';
  } else if (step === 3) {
    if(step3) step3.style.display = 'block';
    if(nextBtn) nextBtn.style.display = 'none';
    if(actions) actions.style.display = 'none';
    if(summary) summary.style.display = 'none';
  }
}

async function handleLogout() {
  if (clerk) {
    await clerk.signOut();
    cart = [];
    localStorage.removeItem('veyano_cart');
    updateCartUI();
    showToast('Logged out');
  }
}

async function placeOrder() {
  const form = document.getElementById('checkout-form');
  if (!form.checkValidity()) {
    return form.reportValidity();
  }

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
    const headers = { 'Content-Type': 'application/json' };
    if (clerk && clerk.session) {
      const token = await clerk.session.getToken();
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/orders`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(orderData)
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to place order');

    showSuccess(result.orderNumber);
  } catch (err) {
    alert(err.message);
  } finally {
    placeBtn.disabled = false;
    placeBtn.textContent = 'Place Order';
  }
}

function showSuccess(orderNumber) {
  const display = document.getElementById('order-number-display');
  if(display) display.textContent = `Order #${orderNumber}`;
  goToStep(3);
  cart = [];
  saveCart();
}

document.addEventListener('DOMContentLoaded', () => {
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
    document.getElementById('view-cart-btn')?.addEventListener('click', () => {
        toggleCart(true);
    });
  }

  document.getElementById('cart-icon-btn')?.addEventListener('click', () => toggleCart(true));
  document.getElementById('nav-login-btn')?.addEventListener('click', () => {
      toggleCart(true);
  });
  document.getElementById('close-cart-btn')?.addEventListener('click', () => toggleCart(false));
  document.getElementById('cart-overlay')?.addEventListener('click', () => toggleCart(false));

  document.getElementById('next-step-btn')?.addEventListener('click', () => {
    if (cart.length === 0) return alert("Your cart is empty!");
    goToStep(2);
  });

  document.getElementById('back-to-cart-btn')?.addEventListener('click', () => {
    goToStep(1);
  });

  document.getElementById('place-order-btn')?.addEventListener('click', placeOrder);

  initClerk();
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

  document.querySelectorAll('input[name="paymentMethod"]').forEach(input => {
    input.addEventListener('change', () => {
      updateCartUI();
    });
  });

  updateCartUI();
});
