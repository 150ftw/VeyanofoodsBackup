// server/routes/webhooks.js — Razorpay webhook handler with HMAC-SHA256 verification

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const { generateInvoice } = require('../services/invoiceService');
const { sendOrderConfirmation } = require('../services/emailService');
require('dotenv').config();

/**
 * POST /api/webhook/razorpay
 * Razorpay sends payment events here
 * Must use raw body for HMAC signature verification — do NOT use express.json() before this
 */
router.post('/razorpay', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // ── HMAC Signature Verification ───────────────────────────────────────────
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(req.body)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.warn('[Webhook] ❌ Invalid Razorpay signature — possible tampered request');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // ── Parse Event ───────────────────────────────────────────────────────────
  let event;
  try {
    event = JSON.parse(req.body.toString());
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  console.log(`[Webhook] Event received: ${event.event}`);

  // Always respond 200 quickly to Razorpay, process async
  res.status(200).json({ status: 'received' });

  // ── Process Events Asynchronously ─────────────────────────────────────────
  setImmediate(async () => {
    try {
      if (event.event === 'payment.captured') {
        await handlePaymentCaptured(event.payload.payment.entity);
      } else if (event.event === 'payment.failed') {
        await handlePaymentFailed(event.payload.payment.entity);
      } else if (event.event === 'refund.created') {
        await handleRefund(event.payload.refund.entity);
      }
    } catch (err) {
      console.error('[Webhook] Error processing event:', err.message);
    }
  });
});

async function handlePaymentCaptured(payment) {
  const { order_id: razorpayOrderId, id: razorpayPaymentId, amount } = payment;

  const order = await Order.findOne({
    where: { razorpayOrderId },
    include: [{ model: OrderItem, as: 'items' }],
  });

  if (!order) {
    console.error(`[Webhook] Order not found for Razorpay order_id: ${razorpayOrderId}`);
    return;
  }

  await order.update({
    paymentStatus: 'paid',
    status: 'confirmed',
    razorpayPaymentId,
  });

  console.log(`[Webhook] ✅ Payment confirmed for order: ${order.orderNumber}`);

  // Generate GST invoice with FSSAI details
  const invoicePath = await generateInvoice(order, order.items);
  await order.update({ invoiceGenerated: true, invoicePath });

  // Send order confirmation email with invoice
  if (order.customerEmail) {
    await sendOrderConfirmation(order, invoicePath);
    console.log(`[Webhook] 📧 Confirmation email sent to ${order.customerEmail}`);
  }
}

async function handlePaymentFailed(payment) {
  const { order_id: razorpayOrderId, id: razorpayPaymentId } = payment;
  const order = await Order.findOne({ where: { razorpayOrderId } });
  if (!order) return;

  await order.update({
    paymentStatus: 'failed',
    status: 'cancelled',
    razorpayPaymentId,
  });

  console.log(`[Webhook] ❌ Payment failed for order: ${order.orderNumber}`);
}

async function handleRefund(refund) {
  const { payment_id, amount } = refund;
  const order = await Order.findOne({ where: { razorpayPaymentId: payment_id } });
  if (!order) return;

  await order.update({
    paymentStatus: 'refunded',
    status: 'refunded',
  });

  console.log(`[Webhook] ↩️ Refund processed for order: ${order.orderNumber}`);
}

module.exports = router;
