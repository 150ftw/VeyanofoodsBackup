// server/routes/orders.js — Omni-channel order management

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/db');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const authMiddleware = require('../middleware/auth');
const { applyCODLogic, isCODReadyForDispatch } = require('../services/codService');
const { deductStock, getNextBatch } = require('../services/fefoService');
const { generateInvoice } = require('../services/invoiceService');
const { sendOrderConfirmation, sendCODAdminAlert } = require('../services/emailService');
const { Op } = require('sequelize');

// Order number generator: VFO-YYYY-XXXXX
async function generateOrderNumber() {
  const year = new Date().getFullYear();
  const count = await Order.count();
  return `VFO-${year}-${String(count + 1).padStart(5, '0')}`;
}

// ── PUBLIC ROUTES ─────────────────────────────────────────────────────────────

/**
 * POST /api/orders — Create order from any channel
 * Public endpoint (called by frontend checkout)
 */
router.post('/', async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const {
      source = 'website',
      paymentMethod,
      items, // Array of { sku, productName, quantity, unitPrice }
      customerName, customerEmail, customerPhone,
      shippingAddress, shippingPincode, shippingCity, shippingState,
      externalOrderId, notes,
      razorpayOrderId,
    } = req.body;

    // Basic validation
    if (!paymentMethod) return res.status(400).json({ error: 'paymentMethod is required (razorpay or cod).' });
    if (!items || !items.length) return res.status(400).json({ error: 'Order must have at least one item.' });
    if (!customerName || !customerPhone || !shippingAddress || !shippingPincode) {
      return res.status(400).json({ error: 'Customer name, phone, shipping address, and pincode are required.' });
    }

    // Calculate totals
    const subtotalAmount = items.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0);
    const gstAmount = Math.round(subtotalAmount * 0.05);
    const discountAmount = req.body.discountAmount || 0;

    // Build order data and apply COD logic
    let orderData = applyCODLogic({
      source, paymentMethod,
      subtotalAmount, gstAmount, discountAmount,
      totalAmount: subtotalAmount + gstAmount - discountAmount,
      customerName, customerEmail, customerPhone,
      shippingAddress, shippingPincode, shippingCity, shippingState,
      externalOrderId, notes, razorpayOrderId,
    });

    // For online payments, set total
    if (paymentMethod === 'razorpay') {
      orderData.totalAmount = subtotalAmount + gstAmount - discountAmount;
    }

    // Get FEFO batch for the primary SKU (first item for order-level tracking)
    let primaryBatch = null;
    try {
      primaryBatch = await getNextBatch(items[0].sku.toUpperCase());
    } catch (e) {
      // Batch lookup optional — some items may not be tracked
    }

    // Create the order
    const order = await Order.create({
      ...orderData,
      orderNumber: await generateOrderNumber(),
      batchId: primaryBatch?.batchId || null,
    }, { transaction: t });

    // Create order items & deduct FEFO stock
    const createdItems = [];
    for (const item of items) {
      const sku = item.sku.toUpperCase();

      // Deduct stock using FEFO
      let batchCode = null;
      try {
        const deductions = await deductStock(sku, item.quantity, t);
        batchCode = deductions[0]?.batchCode || null;
      } catch (e) {
        // If no stock tracking for this SKU, continue (manual inventory management)
        console.warn(`[Orders] Stock deduction skipped for ${sku}: ${e.message}`);
      }

      const orderItem = await OrderItem.create({
        orderId: order.id,
        sku,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.unitPrice * item.quantity,
        batchCode,
      }, { transaction: t });

      createdItems.push(orderItem);
    }

    await t.commit();

    // Post-commit: generate invoice and send emails
    setImmediate(async () => {
      try {
        // Only generate invoice for paid orders; COD gets invoice on delivery
        if (order.paymentStatus === 'paid' || order.isCOD) {
          const invoicePath = await generateInvoice(order, createdItems);
          await order.update({ invoiceGenerated: true, invoicePath });

          if (order.customerEmail) {
            await sendOrderConfirmation(order, invoicePath);
          }
        }

        // Alert admin for COD orders
        if (order.isCOD) {
          await sendCODAdminAlert(order);
        }
      } catch (e) {
        console.error('[Orders] Post-create async tasks failed:', e.message);
      }
    });

    res.status(201).json({
      message: 'Order created successfully.',
      orderId: order.id,
      orderNumber: order.orderNumber,
      isCOD: order.isCOD,
      totalAmount: order.totalAmount,
      shippingFee: order.shippingFee,
      paymentStatus: order.paymentStatus,
    });
  } catch (err) {
    await t.rollback();
    next(err);
  }
});

/** POST /api/orders/whatsapp — WhatsApp order intake (manual) */
router.post('/whatsapp', async (req, res, next) => {
  req.body.source = 'whatsapp';
  req.body.paymentMethod = req.body.paymentMethod || 'cod';
  next();
}, router.post('/'));  // reuse main order creation

/** POST /api/orders/meesho — Meesho order intake */
router.post('/meesho', async (req, res, next) => {
  req.body.source = 'meesho';
  next();
}, router.post('/'));

// ── PROTECTED ROUTES (Admin) ──────────────────────────────────────────────────
router.use(authMiddleware);

/** GET /api/orders — List orders with filters */
router.get('/', async (req, res, next) => {
  try {
    const { source, status, paymentMethod, isCOD, page = 1, limit = 20, startDate, endDate } = req.query;
    const where = {};

    if (source) where.source = source;
    if (status) where.status = status;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (isCOD !== undefined) where.isCOD = isCOD === 'true';
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const offset = (page - 1) * limit;
    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [{ model: OrderItem, as: 'items' }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    // COD pending count for dashboard
    const pendingCOD = await Order.count({
      where: { isCOD: true, codFlagConfirmed: false, status: 'pending' },
    });

    res.json({
      total: count,
      page: parseInt(page),
      pages: Math.ceil(count / limit),
      pendingCODConfirmations: pendingCOD,
      data: rows,
    });
  } catch (err) { next(err); }
});

/** GET /api/orders/:id — Single order detail */
router.get('/:id', async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [{ model: OrderItem, as: 'items' }],
    });
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json(order);
  } catch (err) { next(err); }
});

/** PATCH /api/orders/:id/status — Update order status */
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required.' });

    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    // COD dispatch guard
    if (status === 'packed') {
      const { ready, reason } = isCODReadyForDispatch(order);
      if (!ready) return res.status(400).json({ error: reason });
    }

    await order.update({ status });
    res.json({ message: `Order status updated to '${status}'.`, data: order });
  } catch (err) { next(err); }
});

/** PATCH /api/orders/:id/confirm-cod — Admin confirms COD via phone */
router.patch('/:id/confirm-cod', async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (!order.isCOD) return res.status(400).json({ error: 'This is not a COD order.' });

    await order.update({
      codFlagConfirmed: true,
      codConfirmedAt: new Date(),
      codConfirmedBy: req.user.name,
      status: 'confirmed',
    });

    res.json({ message: 'COD order confirmed. Ready for packing.', data: order });
  } catch (err) { next(err); }
});

module.exports = router;
