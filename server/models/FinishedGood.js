// server/models/FinishedGood.js
// SKU-level finished goods inventory with FEFO batch tracking

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Batch = require('./Batch');

const FinishedGood = sequelize.define('FinishedGood', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  sku: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'PLAIN-200G | SALTED-200G | PERIPERI-200G | COMBO-600G',
  },
  productName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  batchId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: Batch, key: 'id' },
  },
  batchCode: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  quantityUnits: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Units (pouches) in stock',
  },
  mrpPaise: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'MRP in paise (₹399 = 39900)',
  },
  expiryDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'FEFO key — earliest expiry dispatched first',
  },
  warehouseLocation: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('in_stock', 'low_stock', 'out_of_stock', 'expired'),
    defaultValue: 'in_stock',
  },
});

// FK association
FinishedGood.belongsTo(Batch, { foreignKey: 'batchId', as: 'batch' });

module.exports = FinishedGood;
