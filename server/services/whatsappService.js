// server/services/whatsappService.js
const axios = require('axios');
require('dotenv').config();

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const ADMIN_NUMBER = process.env.ADMIN_WHATSAPP_NUMBER;

/**
 * Send a generic text message via WhatsApp Cloud API
 * @param {string} to - Recipient phone number (with country code, no +)
 * @param {string} text - Message body
 */
async function sendWhatsAppMessage(to, text) {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    console.warn('[WhatsApp] Service not configured. Skipping message.');
    return;
  }

  try {
    const response = await axios({
      method: 'POST',
      url: `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text },
      },
    });
    console.log(`[WhatsApp] Message sent to ${to}: ${response.data.messages[0].id}`);
    return response.data;
  } catch (error) {
    console.error('[WhatsApp] Send failed:', error.response ? error.response.data : error.message);
    throw error;
  }
}

/**
 * Send order alert to Admin
 * @param {object} order - Order data
 */
async function sendOrderAlertToAdmin(order) {
  const message = `🛍️ *New Order Received!*\n\n` +
    `*Order #:* ${order.orderNumber}\n` +
    `*Customer:* ${order.customerName}\n` +
    `*Total:* ₹${order.totalAmount}\n` +
    `*Items:* ${order.items?.length || 'View Dashboard'} items\n` +
    `*Payment:* ${order.payment_method.toUpperCase()}\n` +
    `*Phone:* ${order.customer_phone}\n\n` +
    `Check dashboard for shipping details.`;

  return sendWhatsAppMessage(ADMIN_NUMBER, message);
}

/**
 * Send order confirmation to Customer
 * @param {object} order - Order data
 */
async function sendOrderConfirmationToCustomer(order) {
  const to = order.customer_phone.replace(/\D/g, ''); // Ensure only digits
  const message = `Hello ${order.customer_name}! 👋\n\n` +
    `Thank you for ordering from *Veyano Foods*! 🥳\n\n` +
    `Your order *#${order.orderNumber}* for *₹${order.totalAmount}* has been received and is being processed.\n\n` +
    `We will notify you once it's shipped. Stay healthy with Veyano! 🌾`;

  return sendWhatsAppMessage(to, message);
}

module.exports = {
  sendWhatsAppMessage,
  sendOrderAlertToAdmin,
  sendOrderConfirmationToCustomer,
};
