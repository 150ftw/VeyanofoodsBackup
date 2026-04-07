// server/models/Batch.js
// Production batch log — links raw materials to finished goods to orders (FSSAI Traceability)

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Batch = sequelize.define('Batch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  batchCode: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'e.g. VFB-2024-001 — on product label',
  },
  sku: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'PLAIN-200G | SALTED-200G | PERIPERI-200G | COMBO-600G',
  },
  productionDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  expiryDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'MFG + 180 days (6 months)',
  },
  quantityProduced: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Total units produced in this batch',
  },
  quantityRemaining: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Remaining unsold units',
  },
  rawMaterialBatchCodes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON array of raw material batch codes used',
    get() {
      const val = this.getDataValue('rawMaterialBatchCodes');
      return val ? JSON.parse(val) : [];
    },
    set(val) {
      this.setDataValue('rawMaterialBatchCodes', JSON.stringify(val));
    },
  },
  status: {
    type: DataTypes.ENUM('active', 'depleted', 'recalled'),
    defaultValue: 'active',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

module.exports = Batch;
