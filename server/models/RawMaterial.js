// server/models/RawMaterial.js
// FEFO-compliant raw material tracking: Makhana, Spices, Packaging

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const RawMaterial = sequelize.define('RawMaterial', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'e.g. Makhana Grade A, Peri-Peri Spice Mix, Himalayan Pink Salt',
  },
  batchCode: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Supplier batch reference for FSSAI traceability',
  },
  supplierName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  quantityKg: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
    comment: 'Current stock in kilograms',
  },
  unitCostPerKg: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Purchase cost per KG in ₹',
  },
  purchaseDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  expiryDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'FEFO key — earliest expiry consumed first',
  },
  storageLocation: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'e.g. Warehouse Rack A3',
  },
  status: {
    type: DataTypes.ENUM('available', 'low', 'depleted', 'expired'),
    defaultValue: 'available',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

module.exports = RawMaterial;
