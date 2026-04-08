// server/routes/orders.js — Omni-channel order management
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const { applyCODLogic, isCODReadyForDispatch } = require('../services/codService');
const { deductStock } = require('../services/fefoService');
const { generateInvoice } = require('../services/invoiceService');
const { sendOrderConfirmation, sendCODAdminAlert } = require('../services/emailService');
const { sendOrderAlertToAdmin, sendOrderConfirmationToCustomer } = require('../services/whatsappService');

// Order number generator: VFO-YYYY-XXXXX
async function generateOrderNumber() {
  const year = new Date().getFullYear();
  const { count, error } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });
  
  const orderCount = count || 0;
  return `VFO-${year}-${String(orderCount + 1).padStart(5, '0')}`;
}

/**
 * POST /api/orders
 */
router.post('/', async (req, res, next) => {
  try {
    const {
      source = 'website',
      paymentMethod,
      items,
      customerName, customerEmail, customerPhone,
      shippingAddress, shippingPincode, shippingCity, shippingState,
      notes, razorpayOrderId,
    } = req.body;

    if (!paymentMethod) return res.status(400).json({ error: 'paymentMethod is required.' });
    if (!items || !items.length) return res.status(400).json({ error: 'Order must have at least one item.' });

    const subtotalAmount = items.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0);
    const gstAmount = Math.round(subtotalAmount * 0.05);
    const discountAmount = req.body.discountAmount || 0;

    let orderData = applyCODLogic({
      source, paymentMethod,
      subtotalAmount, gstAmount, discountAmount,
      customerName, customerEmail, customerPhone,
      shippingAddress, shippingPincode, shippingCity, shippingState,
      notes, razorpayOrderId,
    });

    const orderNumber = await generateOrderNumber();

    // Map to Supabase snake_case
    const supabaseOrder = {
      order_number: orderNumber,
      source: orderData.source,
      status: orderData.status,
      payment_method: orderData.paymentMethod,
      payment_status: orderData.paymentStatus,
      customer_name: orderData.customerName,
      customer_email: orderData.customerEmail,
      customer_phone: orderData.customerPhone,
      shipping_address: orderData.shippingAddress,
      shipping_pincode: orderData.shippingPincode,
      shipping_city: orderData.shippingCity,
      shipping_state: orderData.shippingState,
      subtotal_amount: orderData.subtotalAmount,
      shipping_fee: orderData.shippingFee,
      gst_amount: orderData.gstAmount,
      total_amount: orderData.totalAmount,
      is_cod: orderData.isCOD,
      razorpay_order_id: orderData.razorpayOrderId
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([supabaseOrder])
      .select()
      .single();

    if (orderError) throw orderError;

    const createdItems = [];
    for (const item of items) {
      // Robust SKU resolution
      const sku = (item.sku || item.id || 'UNKNOWN').toUpperCase();
      
      try {
        await deductStock(sku, item.quantity);
      } catch (e) {
        console.warn(`[Orders] Stock deduction skipped for ${sku}: ${e.message}`);
      }

      const { data: orderItem, error: itemError } = await supabase
        .from('order_items')
        .insert([{
          order_id: order.id,
          sku,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.unitPrice * item.quantity
        }])
        .select()
        .single();

      if (itemError) console.error('Error creating order item:', itemError);
      else createdItems.push(orderItem);
    }

    // Post-create tasks (Async)
    setImmediate(async () => {
      try {
        if (order.payment_status === 'paid' || order.is_cod) {
          // Map back to camelCase for invoice service if needed
          const camelOrder = {
             ...order,
             orderNumber: order.order_number,
             customerName: order.customer_name,
             customerPhone: order.customer_phone,
             customerEmail: order.customer_email,
             shippingAddress: order.shipping_address,
             shippingCity: order.shipping_city,
             shippingState: order.shipping_state,
             shippingPincode: order.shipping_pincode,
             subtotalAmount: order.subtotal_amount,
             gstAmount: order.gst_amount,
             shippingFee: order.shipping_fee,
             totalAmount: order.total_amount,
             paymentMethod: order.payment_method,
             paymentStatus: order.payment_status
          };
          const camelItems = createdItems.map(i => ({
              ...i,
              productName: i.product_name,
              unitPrice: i.unit_price,
              totalPrice: i.total_price
          }));

          const invoicePath = await generateInvoice(camelOrder, camelItems);
          
          await supabase
            .from('orders')
            .update({ status: order.is_cod ? 'pending' : 'confirmed' })
            .eq('id', order.id);

          if (order.customer_email) {
            await sendOrderConfirmation(camelOrder, invoicePath);
          }

          // ── WhatsApp Notifications ──────────────────────────────────
          try {
            await sendOrderAlertToAdmin(camelOrder);
            await sendOrderConfirmationToCustomer(camelOrder);
          } catch (wsErr) {
            console.error('[Orders] WhatsApp notifications failed:', wsErr.message);
          }
        }

        if (order.is_cod) {
          const camelOrder = { ...order, orderNumber: order.order_number };
          await sendCODAdminAlert(camelOrder);
        }
      } catch (e) {
        console.error('[Orders] Post-create failed:', e.message);
      }
    });

    res.status(201).json({
      message: 'Order created successfully.',
      orderId: order.id,
      orderNumber: order.order_number,
      isCOD: order.is_cod,
      totalAmount: order.total_amount,
    });

  } catch (err) {
    next(err);
  }
});

router.use(authMiddleware);

/**
 * GET /api/orders
 */
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
