// server/routes/logistics.js — Smart Logistics Bridge (Shiprocket)

const express = require('express');
const router = express.Router();
const path = require('path');
const authMiddleware = require('../middleware/auth');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const {
  createShipment, generateLabel, generateManifest, trackShipment, getAWBDetails
} = require('../services/shiprocketService');
const { sendShippingNotification } = require('../services/emailService');
const { isCODReadyForDispatch } = require('../services/codService');

router.use(authMiddleware);

/**
 * POST /api/logistics/ship/:orderId
 * Trigger Shiprocket shipment creation for a packed order
 */
router.post('/ship/:orderId', async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.orderId, {
      include: [{ model: OrderItem, as: 'items' }],
    });

    if (!order) return res.status(404).json({ error: 'Order not found.' });

    // State check
    if (order.status !== 'packed') {
      return res.status(400).json({ error: `Order must be in 'packed' status before shipping. Current: ${order.status}` });
    }

    // COD dispatch guard
    const { ready, reason } = isCODReadyForDispatch(order);
    if (!ready) return res.status(400).json({ error: reason });

    // Create shipment on Shiprocket
    const result = await createShipment(order, order.items);
    await order.update({
      ...result,
      status: 'shipped',
      shippedAt: new Date(),
    });

    // Get AWB code (may take a moment to be assigned)
    setTimeout(async () => {
      try {
        const { awbCode, courierName } = await getAWBDetails(result.shiprocketShipmentId);
        if (awbCode) {
          await order.update({ awbCode, courierName });
          if (order.customerEmail) {
            await sendShippingNotification({ ...order.toJSON(), awbCode, courierName });
          }
        }
      } catch (e) {
        console.error('[Logistics] AWB fetch failed:', e.message);
      }
    }, 5000);

    res.json({
      message: 'Shipment created successfully.',
      shiprocketOrderId: result.shiprocketOrderId,
      shiprocketShipmentId: result.shiprocketShipmentId,
      status: result.status,
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/logistics/label/:orderId — Get shipping label PDF URL
 */
router.get('/label/:orderId', async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (!order.shiprocketShipmentId) {
      return res.status(400).json({ error: 'Shipment not yet created for this order.' });
    }

    const labelUrl = await generateLabel(order.shiprocketShipmentId);
    if (!labelUrl) return res.status(404).json({ error: 'Label not yet available. Try again in a moment.' });

    res.json({ labelUrl });
  } catch (err) { next(err); }
});

/**
 * POST /api/logistics/manifest — Generate today's pickup manifest
 * Body: { orderIds: ['uuid1', 'uuid2'] }
 */
router.post('/manifest', async (req, res, next) => {
  try {
    const { orderIds } = req.body;
    if (!orderIds || !orderIds.length) {
      return res.status(400).json({ error: 'orderIds array is required.' });
    }

    const orders = await Order.findAll({ where: { id: orderIds } });
    const shipmentIds = orders.map(o => o.shiprocketShipmentId).filter(Boolean);

    if (!shipmentIds.length) {
      return res.status(400).json({ error: 'No valid shipments found for provided order IDs.' });
    }

    const manifestUrl = await generateManifest(shipmentIds);
    res.json({ manifestUrl, shipmentCount: shipmentIds.length });
  } catch (err) { next(err); }
});

/**
 * GET /api/logistics/track/:orderId — Track shipment status
 */
router.get('/track/:orderId', async (req, res, next) => {
  try {
    const order = await Order.findByPk(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (!order.awbCode) return res.status(400).json({ error: 'No AWB code found for this order.' });

    const tracking = await trackShipment(order.awbCode);
    res.json({ orderNumber: order.orderNumber, awbCode: order.awbCode, tracking });
  } catch (err) { next(err); }
});

module.exports = router;
