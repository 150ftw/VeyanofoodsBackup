// server/seed.js — Database Seeding Script
const sequelize = require('./config/db');
const User = require('./models/User');
const Batch = require('./models/Batch');
const FinishedGood = require('./models/FinishedGood');
const RawMaterial = require('./models/RawMaterial');
const Order = require('./models/Order');
const OrderItem = require('./models/OrderItem');

async function seed() {
  try {
    console.log('🌱 Starting database seeding...');

    // Force sync (drops all tables)
    await sequelize.sync({ force: true });
    console.log('✅ Database synchronized (tables dropped and recreated).');

    // 1. Seed Admin User
    const admin = await User.create({
      name: 'Veyano Admin',
      email: 'admin@veyano.in',
      phone: '9999999999',
      password: 'adminpassword123',
      role: 'admin'
    });
    console.log('👤 Admin user created.');

    // 2. Seed Raw Materials
    const makhanaRaw = await RawMaterial.create({
      name: 'Premium Fox Nuts (Raw)',
      batchCode: 'RM-MAK-001',
      supplierName: 'Bihar Farms Ltd.',
      quantityKg: 500,
      unitCostPerKg: 450,
      purchaseDate: new Date(),
      expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months
      status: 'available'
    });
    console.log('🌾 Raw materials seeded.');

    // 3. Seed Production Batches
    const products = [
      { sku: 'PLAIN', name: 'Classic Plain Makhana', price: 399 },
      { sku: 'SALTED', name: 'Lightly Salted Makhana', price: 399 },
      { sku: 'PERIPERI', name: 'Fiery Peri-Peri Makhana', price: 399 },
      { sku: 'COMBO', name: 'The Ultimate Combo Pack', price: 899 }
    ];

    for (const p of products) {
      const batchCode = `VFB-2024-${p.sku.substring(0, 3)}-01`;
      const batch = await Batch.create({
        batchCode,
        sku: p.sku,
        productionDate: new Date(),
        expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        quantityProduced: 200,
        quantityRemaining: 200,
        rawMaterialBatchCodes: ['RM-MAK-001'],
        status: 'active'
      });

      // 4. Seed Finished Goods (Inventory)
      await FinishedGood.create({
        sku: p.sku,
        productName: p.name,
        batchId: batch.id,
        batchCode: batch.batchCode,
        quantityUnits: 200,
        mrpPaise: p.price * 100,
        expiryDate: batch.expiryDate,
        warehouseLocation: 'Section-A1',
        status: 'in_stock'
      });
    }
    console.log('📦 Batches and Finished Goods seeded.');

    console.log('✨ Seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seed();
