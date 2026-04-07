// server/models/OrderItem.js — Line items for each order

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Order = require('./Order');

const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: Order, key: 'id' },
  },
  sku: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  productName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  unitPrice: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Price in ₹ at time of order',
  },
  totalPrice: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'quantity × unitPrice',
  },
  batchCode: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Physical batch dispatched for this line item (FSSAI)',
  },
});

Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

module.exports = OrderItem;
