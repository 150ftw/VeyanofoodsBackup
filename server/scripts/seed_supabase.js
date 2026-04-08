// server/scripts/seed_supabase.js
const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('🌱 Seeding Supabase...');

  // 1. Seed Products
  const products = [
    { sku: 'PLAIN', product_name: 'Classic Plain Makhana', price_paise: 39900, stock_quantity: 200, details: 'Premium Grade Fox Nuts (Makhana).' },
    { sku: 'SALTED', product_name: 'Lightly Salted Makhana', price_paise: 39900, stock_quantity: 200, details: 'Premium Grade Fox Nuts (Makhana), Himalayan Pink Salt, Rice Bran Oil.' },
    { sku: 'PERIPERI', product_name: 'Fiery Peri-Peri Makhana', price_paise: 39900, stock_quantity: 200, details: 'Premium Grade Fox Nuts (Makhana), Peri-Peri Spice Blend, Rice Bran Oil.' },
    { sku: 'COMBO', product_name: 'The Ultimate Combo Pack', price_paise: 89900, stock_quantity: 200, details: 'Contains Plain, Salted, and Peri-Peri 200g Packs.' }
  ];

  const { error: pError } = await supabase.from('products').upsert(products, { onConflict: 'sku' });
  if (pError) console.error('Error seeding products:', pError.message);
  else console.log('✅ Products seeded.');

  // 2. Seed Admin User
  const hashedPassword = await bcrypt.hash('adminpassword123', 12);
  const adminUser = {
    name: 'Veyano Admin',
    email: 'admin@veyano.in',
    phone: '9999999999',
    password: hashedPassword,
    role: 'admin'
  };

  const { error: uError } = await supabase.from('users').upsert([adminUser], { onConflict: 'email' });
  if (uError) console.error('Error seeding admin user:', uError.message);
  else console.log('✅ Admin user seeded.');

  console.log('✨ Supabase seeding complete.');
  process.exit(0);
}

seed();
