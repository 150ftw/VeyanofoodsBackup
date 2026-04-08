-- Schema for Veyano Foods Supabase Migration

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'customer',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Products Table (Replacing FinishedGoods)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  product_name TEXT NOT NULL,
  price_paise INTEGER NOT NULL, -- ₹399 = 39900
  stock_quantity INTEGER DEFAULT 0,
  details TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  source TEXT DEFAULT 'website',
  status TEXT DEFAULT 'pending',
  payment_method TEXT NOT NULL,
  payment_status TEXT DEFAULT 'pending',
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  shipping_pincode TEXT NOT NULL,
  shipping_city TEXT,
  shipping_state TEXT,
  subtotal_amount INTEGER NOT NULL,
  shipping_fee INTEGER DEFAULT 0,
  gst_amount INTEGER DEFAULT 0,
  total_amount INTEGER NOT NULL,
  is_cod BOOLEAN DEFAULT false,
  razorpay_order_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  total_price INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indices for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
