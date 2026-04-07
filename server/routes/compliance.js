// server/routes/compliance.js — FSSAI Compliance Vault

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Batch = require('../models/Batch');
const FinishedGood = require('../models/FinishedGood');
const RawMaterial = require('../models/RawMaterial');
const { generateInvoice } = require('../services/invoiceService');

router.use(authMiddleware);

/**
 * GET /api/compliance/invoice/:orderId
 * Download GST invoice PDF for an order
 */
router.get('/invoice/:orderId', async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.orderId, {
      include: [{ model: OrderItem, as: 'items' }],
    });
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    let invoicePath = order.invoicePath;

    // Regenerate if not found
    if (!invoicePath || !fs.existsSync(invoicePath)) {
      invoicePath = await generateInvoice(order, order.items);
      await order.update({ invoiceGenerated: true, invoicePath });
    }

    res.download(invoicePath, `Invoice-${order.orderNumber}.pdf`);
  } catch (err) { next(err); }
});

/**
 * GET /api/compliance/batch/:batchId
 * Full batch traceability: which raw materials → which orders
 */
router.get('/batch/:batchId', async (req, res, next) => {
  try {
    const batch = await Batch.findByPk(req.params.batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found.' });

    // Find all finished goods from this batch
    const finishedGoods = await FinishedGood.findAll({
      where: { batchId: batch.id },
    });

    // Find all orders fulfilled from this batch
    const orders = await Order.findAll({
      where: { batchId: batch.id },
      include: [{ model: OrderItem, as: 'items' }],
      order: [['createdAt', 'DESC']],
    });

    // Find the raw materials used
    const rawBatchCodes = batch.rawMaterialBatchCodes || [];
    const rawMaterials = rawBatchCodes.length
      ? await RawMaterial.findAll({ where: { batchCode: rawBatchCodes } })
      : [];

    res.json({
      batch: {
        id: batch.id,
        batchCode: batch.batchCode,
        sku: batch.sku,
        productionDate: batch.productionDate,
        expiryDate: batch.expiryDate,
        quantityProduced: batch.quantityProduced,
        quantityRemaining: batch.quantityRemaining,
        status: batch.status,
      },
      rawMaterialsUsed: rawMaterials,
      finishedGoods,
      ordersFulfilled: {
        count: orders.length,
        totalUnitsDispatched: orders.reduce((sum, o) =>
          sum + o.items.reduce((s, i) => s + i.quantity, 0), 0),
        orders: orders.map(o => ({
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          customerPhone: o.customerPhone,
          createdAt: o.createdAt,
          status: o.status,
          items: o.items,
        })),
      },
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/compliance/trace/:orderId
 * Backward trace: which batch fulfilled this specific order?
 */
router.get('/trace/:orderId', async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.orderId, {
      include: [{ model: OrderItem, as: 'items' }],
    });
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    // Get batch codes from order items
    const batchCodes = [...new Set(order.items.map(i => i.batchCode).filter(Boolean))];

    const finishedGoods = batchCodes.length
      ? await FinishedGood.findAll({ where: { batchCode: batchCodes } })
      : [];

    const batchIds = [...new Set(finishedGoods.map(g => g.batchId).filter(Boolean))];
    const batches = batchIds.length
      ? await Batch.findAll({ where: { id: batchIds } })
      : [];

    // Find raw materials for those batches
    const rawBatchCodes = batches.flatMap(b => b.rawMaterialBatchCodes || []);
    const rawMaterials = rawBatchCodes.length
      ? await RawMaterial.findAll({ where: { batchCode: rawBatchCodes } })
      : [];

    res.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        customerName: order.customerName,
        items: order.items,
      },
      traceability: {
        productionBatches: batches.map(b => ({
          batchCode: b.batchCode,
          sku: b.sku,
          productionDate: b.productionDate,
          expiryDate: b.expiryDate,
        })),
        rawMaterialsUsed: rawMaterials.map(r => ({
          name: r.name,
          batchCode: r.batchCode,
          supplierName: r.supplierName,
          expiryDate: r.expiryDate,
        })),
      },
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/compliance/fssai-report
 * Monthly FSSAI-style traceability report summary
 */
router.get('/fssai-report', async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);

    const orders = await Order.findAll({
      where: {
        createdAt: { $between: [startDate, endDate] },
        status: { $notIn: ['cancelled'] },
      },
      include: [{ model: OrderItem, as: 'items' }],
    });

    const totalUnitsDispatched = orders.reduce((sum, o) =>
      sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);

    const batches = await Batch.findAll({
      where: {
        productionDate: { $between: [startDate, endDate] },
      },
    });

    res.json({
      reportPeriod: `${String(m).padStart(2, '0')}/${y}`,
      fssaiLicenseId: '20826010000397',
      businessName: 'Veyano Foods',
      summary: {
        totalOrders: orders.length,
        totalUnitsDispatched,
        batchesProduced: batches.length,
        totalUnitsProduced: batches.reduce((sum, b) => sum + b.quantityProduced, 0),
      },
      batches: batches.map(b => ({
        batchCode: b.batchCode,
        sku: b.sku,
        productionDate: b.productionDate,
        expiryDate: b.expiryDate,
        quantityProduced: b.quantityProduced,
        status: b.status,
      })),
    });
  } catch (err) { next(err); }
});

module.exports = router;
