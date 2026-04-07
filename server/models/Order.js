// server/models/Order.js — Omni-channel order master record

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  orderNumber: {
    type: DataTypes.STRING,
    unique: true,
    comment: 'Human-readable: VFO-2024-0001',
  },
  source: {
    type: DataTypes.ENUM('website', 'whatsapp', 'meesho', 'manual'),
    allowNull: false,
    defaultValue: 'website',
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'),
    defaultValue: 'pending',
  },
  paymentMethod: {
    type: DataTypes.ENUM('razorpay', 'cod', 'upi', 'bank_transfer'),
    allowNull: false,
  },
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
    defaultValue: 'pending',
  },
  razorpayOrderId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  razorpayPaymentId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  razorpaySignature: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // COD fields
  isCOD: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  codFlagConfirmed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Admin must phone-confirm before dispatch',
  },
  codConfirmedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  codConfirmedBy: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Amounts (in ₹, not paise for readability)
  subtotalAmount: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  shippingFee: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '0 for prepaid ≥₹499, or ₹99 for COD',
  },
  discountAmount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  totalAmount: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  gstAmount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '5% GST on food items',
  },
  // Customer details
  customerName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  customerEmail: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  customerPhone: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  shippingAddress: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  shippingPincode: {
    type: DataTypes.STRING(6),
    allowNull: false,
  },
  shippingCity: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  shippingState: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Logistics
  awbCode: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Shiprocket tracking number',
  },
  shiprocketOrderId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  shiprocketShipmentId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  courierName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  shippedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  deliveredAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // FSSAI / Compliance
  batchId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Batch from which this order was fulfilled',
  },
  invoiceGenerated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  invoicePath: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // WhatsApp / Meesho reference
  externalOrderId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Meesho/WhatsApp order ref',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

module.exports = Order;
