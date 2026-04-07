// server/services/shiprocketService.js
// Shiprocket API integration bridge — shipping, labels, and manifests

const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.SHIPROCKET_API_URL || 'https://apiv2.shiprocket.in/v1/external';
let authToken = null;
let tokenExpiry = null;

/**
 * Authenticate with Shiprocket and get a Bearer token (cached for 24h)
 */
async function authenticate() {
  const now = Date.now();
  if (authToken && tokenExpiry && now < tokenExpiry) return authToken;

  const response = await axios.post(`${BASE_URL}/auth/login`, {
    email: process.env.SHIPROCKET_EMAIL,
    password: process.env.SHIPROCKET_PASSWORD,
  });

  authToken = response.data.token;
  tokenExpiry = now + 23 * 60 * 60 * 1000; // Refresh 1hr before 24h expiry
  return authToken;
}

function getHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Create a shipment order on Shiprocket
 * @param {object} order - Order model instance with items
 * @param {Array} items - OrderItem instances
 * @returns {{shiprocketOrderId, shiprocketShipmentId, awbCode, courierName}}
 */
async function createShipment(order, items) {
  const token = await authenticate();

  const payload = {
    order_id: order.orderNumber,
    order_date: new Date(order.createdAt).toISOString().split('T')[0],
    pickup_location: 'Home',
    channel_id: '',
    comment: `Veyano Foods Order via ${order.source}`,
    billing_customer_name: order.customerName,
    billing_last_name: '',
    billing_address: order.shippingAddress,
    billing_city: order.shippingCity || 'Unknown',
    billing_pincode: order.shippingPincode,
    billing_state: order.shippingState || 'Unknown',
    billing_country: 'India',
    billing_email: order.customerEmail || 'customer@example.com',
    billing_phone: order.customerPhone,
    shipping_is_billing: true,
    order_items: items.map(item => ({
      name: item.productName,
      sku: item.sku,
      units: item.quantity,
      selling_price: item.unitPrice,
      discount: 0,
      tax: '5',
      hsn: 1904, // HSN code for puffed/roasted makhana
    })),
    payment_method: order.isCOD ? 'COD' : 'Prepaid',
    shipping_charges: order.shippingFee,
    sub_total: order.subtotalAmount,
    length: 15,
    breadth: 10,
    height: 5,
    weight: items.reduce((sum, i) => sum + (i.quantity * 0.22), 0), // ~220g per unit
  };

  const response = await axios.post(`${BASE_URL}/orders/create/adhoc`, payload, {
    headers: getHeaders(token),
  });

  const data = response.data;

  // Assign courier automatically using Shiprocket's AI recommendation
  if (data.order_id && data.shipment_id) {
    await assignCourier(data.shipment_id, token);
  }

  return {
    shiprocketOrderId: String(data.order_id),
    shiprocketShipmentId: String(data.shipment_id),
    status: data.status,
  };
}

/**
 * Auto-assign cheapest available courier using Shiprocket's recommendation
 */
async function assignCourier(shipmentId, token) {
  await axios.post(`${BASE_URL}/courier/assign/awb`, {
    shipment_id: shipmentId,
  }, { headers: getHeaders(token) });
}

/**
 * Get AWB code and courier name for a shipment
 * @param {string} shiprocketShipmentId
 */
async function getAWBDetails(shiprocketShipmentId) {
  const token = await authenticate();
  const response = await axios.get(
    `${BASE_URL}/shipments?id=${shiprocketShipmentId}`,
    { headers: getHeaders(token) }
  );
  const shipment = response.data?.data?.shipments?.[0];
  return {
    awbCode: shipment?.awb_code || null,
    courierName: shipment?.courier_name || null,
  };
}

/**
 * Generate a shipping label PDF URL for an order
 * @param {string} shiprocketShipmentId
 * @returns {string} PDF URL
 */
async function generateLabel(shiprocketShipmentId) {
  const token = await authenticate();
  const response = await axios.post(`${BASE_URL}/courier/generate/label`, {
    shipment_id: [shiprocketShipmentId],
  }, { headers: getHeaders(token) });

  return response.data?.label_url || null;
}

/**
 * Generate a pickup manifest for a list of shipment IDs
 * @param {string[]} shiprocketShipmentIds
 * @returns {string} Manifest PDF URL
 */
async function generateManifest(shiprocketShipmentIds) {
  const token = await authenticate();
  const response = await axios.post(`${BASE_URL}/manifests/generate`, {
    shipment_id: shiprocketShipmentIds,
  }, { headers: getHeaders(token) });

  return response.data?.manifest_url || null;
}

/**
 * Track shipment status by AWB code
 * @param {string} awbCode
 */
async function trackShipment(awbCode) {
  const token = await authenticate();
  const response = await axios.get(`${BASE_URL}/courier/track/awb/${awbCode}`, {
    headers: getHeaders(token),
  });
  return response.data?.tracking_data || null;
}

module.exports = { createShipment, generateLabel, generateManifest, trackShipment, getAWBDetails };
