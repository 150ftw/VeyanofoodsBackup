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

  const deliveryFee = subtotal >= 499 ? 0 : 50;
  const total = subtotal + deliveryFee;

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
  }
}

// Razorpay Integration
function setupRazorpay() {
  const checkoutBtn = document.getElementById('checkout-btn');
  if(!checkoutBtn) return;

  checkoutBtn.addEventListener('click', () => {
    if (cart.length === 0) return alert("Your cart is empty!");

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = subtotal >= 499 ? 0 : 50;
    const totalAmount = (subtotal + deliveryFee) * 100; // Amount in paise

    const options = {
      "key": "rzp_test_placeholder", // Replace with actual Key ID
      "amount": totalAmount,
      "currency": "INR",
      "name": "Veyano Foods",
      "description": "Premium Roasted Makhana Order",
      "handler": function (response){
          alert("Payment Successful! ID: " + response.razorpay_payment_id);
          cart = [];
          saveCart();
          toggleCart(false);
      },
      "prefill": {
          "name": "Customer Name",
          "email": "customer@example.com",
          "contact": "9999999999"
      },
      "theme": {
          "color": "#c08b5c"
      }
    };
    const rzp1 = new window.Razorpay(options);
    rzp1.open();
  });
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
        // update URL
        const newurl = window.location.pathname + '?variant=' + v;
        window.history.replaceState({path:newurl},'',newurl);
      });
    });

    document.getElementById('add-to-cart-btn')?.addEventListener('click', () => {
        window.addToCart(variant);
    });
  }

  // Global listeners for Homepage "View Details" logic or direct add
  // Currently "View Details" links to product page, but we could add direct "Add to cart" buttons
  // Using querySelectorAll to find all product card links and potentially hijacking them or adding direct buttons
  
  // Cart toggle listeners
  document.getElementById('cart-icon-btn')?.addEventListener('click', () => toggleCart(true));
  document.getElementById('close-cart-btn')?.addEventListener('click', () => toggleCart(false));
  document.getElementById('cart-overlay')?.addEventListener('click', () => toggleCart(false));

  setupRazorpay();
  updateCartUI();
});
