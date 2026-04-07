// server/tests/fefoService.test.js — FEFO logic unit tests

const { getNextBatch, deductStock, getTotalStock } = require('../services/fefoService');
const sequelize = require('../config/db');
const FinishedGood = require('../models/FinishedGood');
const Batch = require('../models/Batch');
require('../models/Order');
require('../models/OrderItem');

beforeAll(async () => {
  await sequelize.sync({ force: true });

  // Create test batches
  const batch1 = await Batch.create({
    batchCode: 'TEST-BATCH-001',
    sku: 'PLAIN-200G',
    productionDate: '2024-01-01',
    expiryDate: '2024-07-01', // Expires sooner — FEFO should pick this first
    quantityProduced: 100,
    quantityRemaining: 100,
  });

  await FinishedGood.create({
    sku: 'PLAIN-200G',
    productName: 'Classic Plain Makhana',
    batchId: batch1.id,
    batchCode: 'TEST-BATCH-001',
    quantityUnits: 50,
    mrpPaise: 39900,
    expiryDate: '2024-07-01',
  });

  const batch2 = await Batch.create({
    batchCode: 'TEST-BATCH-002',
    sku: 'PLAIN-200G',
    productionDate: '2024-02-01',
    expiryDate: '2025-12-31', // Expires later
    quantityProduced: 200,
    quantityRemaining: 200,
  });

  await FinishedGood.create({
    sku: 'PLAIN-200G',
    productName: 'Classic Plain Makhana',
    batchId: batch2.id,
    batchCode: 'TEST-BATCH-002',
    quantityUnits: 100,
    mrpPaise: 39900,
    expiryDate: '2025-12-31',
  });
});

afterAll(async () => {
  await sequelize.close();
});

describe('FEFO Service', () => {
  test('getNextBatch returns the earliest-expiring batch', async () => {
    const batch = await getNextBatch('PLAIN-200G');
    expect(batch).not.toBeNull();
    expect(batch.batchCode).toBe('TEST-BATCH-001'); // Should return sooner-expiring batch
  });

  test('getTotalStock sums all available batches', async () => {
    const total = await getTotalStock('PLAIN-200G');
    expect(total).toBe(150); // 50 + 100
  });

  test('deductStock deducts from FEFO batch correctly', async () => {
    const t = await sequelize.transaction();
    const log = await deductStock('PLAIN-200G', 30, t);
    await t.commit();

    expect(log).toHaveLength(1);
    expect(log[0].batchCode).toBe('TEST-BATCH-001'); // FEFO: earliest expiry
    expect(log[0].quantityDeducted).toBe(30);

    const remaining = await getTotalStock('PLAIN-200G');
    expect(remaining).toBe(120); // 150 - 30
  });

  test('deductStock spans multiple batches when needed', async () => {
    const t = await sequelize.transaction();
    const log = await deductStock('PLAIN-200G', 30, t); // exhaust batch 001 (20 left)
    await t.commit();

    // Should spread across both batches
    const total = await getTotalStock('PLAIN-200G');
    expect(total).toBe(90);
  });

  test('deductStock throws when insufficient stock', async () => {
    const t = await sequelize.transaction();
    await expect(deductStock('PLAIN-200G', 10000, t)).rejects.toThrow('Insufficient stock');
    await t.rollback();
  });
});

describe('COD Service', () => {
  const { applyCODLogic, isCODReadyForDispatch } = require('../services/codService');

  test('applyCODLogic adds ₹99 surcharge for COD', () => {
    const result = applyCODLogic({
      paymentMethod: 'cod',
      subtotalAmount: 399,
    });
    expect(result.shippingFee).toBe(99);
    expect(result.isCOD).toBe(true);
    expect(result.codFlagConfirmed).toBe(false);
  });

  test('COD order is not ready for dispatch without phone confirmation', () => {
    const { ready, reason } = isCODReadyForDispatch({ isCOD: true, codFlagConfirmed: false });
    expect(ready).toBe(false);
    expect(reason).toContain('phone confirmation');
  });

  test('prepaid order has no COD surcharge', () => {
    const result = applyCODLogic({
      paymentMethod: 'razorpay',
      subtotalAmount: 399,
    });
    expect(result.isCOD).toBe(false);
    expect(result.shippingFee).toBe(0); // ₹399 > ₹0 threshold check: using free if >=499 else 50
  });
});
