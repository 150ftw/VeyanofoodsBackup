// server/services/fefoService.js
// FEFO (First Expiring, First Out) — Core inventory deduction logic for FSSAI compliance

const { Op } = require('sequelize');
const FinishedGood = require('../models/FinishedGood');
const Batch = require('../models/Batch');
const sequelize = require('../config/db');

const LOW_STOCK_THRESHOLD = 50; // units

/**
 * Get the earliest-expiring available batch for a given SKU (FEFO order)
 * @param {string} sku - e.g. 'PLAIN-200G'
 * @returns {FinishedGood|null}
 */
async function getNextBatch(sku) {
  return FinishedGood.findOne({
    where: {
      sku,
      quantityUnits: { [Op.gt]: 0 },
      status: { [Op.in]: ['in_stock', 'low_stock'] },
      expiryDate: { [Op.gte]: new Date() }, // Only non-expired
    },
    order: [['expiryDate', 'ASC']], // FEFO: earliest first
    include: [{ model: Batch, as: 'batch' }],
  });
}

/**
 * Deduct stock from FEFO-ordered batches for a given SKU
 * Works across multiple batches if needed (e.g. 30 from batch A, 20 from batch B)
 * Returns list of { batchCode, quantityDeducted } for invoice traceability
 * @param {string} sku
 * @param {number} requiredQty
 * @param {object} transaction - Sequelize transaction
 * @returns {Array<{batchCode: string, quantityDeducted: number}>}
 */
async function deductStock(sku, requiredQty, transaction) {
  const batches = await FinishedGood.findAll({
    where: {
      sku,
      quantityUnits: { [Op.gt]: 0 },
      status: { [Op.in]: ['in_stock', 'low_stock'] },
      expiryDate: { [Op.gte]: new Date() },
    },
    order: [['expiryDate', 'ASC']],
    transaction,
  });

  const totalAvailable = batches.reduce((sum, b) => sum + b.quantityUnits, 0);
  if (totalAvailable < requiredQty) {
    throw new Error(`Insufficient stock for SKU: ${sku}. Available: ${totalAvailable}, Required: ${requiredQty}`);
  }

  const deductionLog = [];
  let remaining = requiredQty;

  for (const batch of batches) {
    if (remaining <= 0) break;

    const deduct = Math.min(batch.quantityUnits, remaining);
    const newQty = batch.quantityUnits - deduct;

    let newStatus = 'in_stock';
    if (newQty === 0) newStatus = 'out_of_stock';
    else if (newQty < LOW_STOCK_THRESHOLD) newStatus = 'low_stock';

    await batch.update({ quantityUnits: newQty, status: newStatus }, { transaction });

    // If batch depleted, mark the Batch record too
    if (newQty === 0) {
      await Batch.update(
        { status: 'depleted', quantityRemaining: 0 },
        { where: { id: batch.batchId }, transaction }
      );
    } else {
      await Batch.update(
        { quantityRemaining: sequelize.literal(`quantityRemaining - ${deduct}`) },
        { where: { id: batch.batchId }, transaction }
      );
    }

    deductionLog.push({ batchCode: batch.batchCode, quantityDeducted: deduct });
    remaining -= deduct;
  }

  return deductionLog;
}

/**
 * Get all SKUs with stock below LOW_STOCK_THRESHOLD
 * @returns {Array<{sku: string, totalUnits: number}>}
 */
async function getLowStockAlerts() {
  const goods = await FinishedGood.findAll({
    where: {
      status: { [Op.in]: ['low_stock', 'out_of_stock'] },
    },
    attributes: ['sku', 'productName', 'quantityUnits', 'expiryDate', 'status'],
    order: [['quantityUnits', 'ASC']],
  });
  return goods;
}

/**
 * Check total available stock for a SKU across all valid batches
 * @param {string} sku
 * @returns {number}
 */
async function getTotalStock(sku) {
  const result = await FinishedGood.findAll({
    where: {
      sku,
      status: { [Op.in]: ['in_stock', 'low_stock'] },
      expiryDate: { [Op.gte]: new Date() },
    },
    attributes: ['quantityUnits'],
  });
  return result.reduce((sum, r) => sum + r.quantityUnits, 0);
}

module.exports = { getNextBatch, deductStock, getLowStockAlerts, getTotalStock };
